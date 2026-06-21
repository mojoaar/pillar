import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import next from 'next';
import { parse } from 'url';
import { decode } from 'next-auth/jwt';
import { db } from './src/lib/db';
import { decrypt } from './src/lib/crypto';
import { connectSSH } from './src/lib/ssh';
import { writeAudit } from './src/lib/audit';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js app instance
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Helper to parse cookies from header
function parseCookies(cookieHeader: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('='));
    }
  });
  return list;
}

// In-Memory sliding-window rate-limiter bucket registry (Finding #1)
const rateLimitBuckets = new Map<string, number[]>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = rateLimitBuckets.get(key) || [];
  const windowStart = now - windowMs;
  
  // Filter out timestamps older than the sliding window
  const recent = timestamps.filter((t) => t > windowStart);
  
  if (recent.length >= maxRequests) {
    return false;
  }
  
  recent.push(now);
  rateLimitBuckets.set(key, recent);
  return true;
}

// Express rate-limiting middleware creator
function rateLimitMiddleware(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    const key = `${req.path}:${ip}`;
    
    if (!checkRateLimit(key, maxRequests, windowMs)) {
      res.status(429).json({ error: 'Too many requests. Please slow down and try again later.' });
      return;
    }
    
    next();
  };
}

app.prepare().then(() => {
  const expressApp = express();
  const server = http.createServer(expressApp);

  // ==========================================
  // HTTP SECURITY HEADERS MIDDLEWARE (Finding #3)
  // ==========================================
  expressApp.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY'); // Prevent Framing Clickjacking
    res.setHeader('X-Content-Type-Options', 'nosniff'); // Prevent MIME Sniffing
    res.setHeader('Referrer-Policy', 'same-origin');
    
    // Strict CSP Whitelisting Self-Origin, Google Fonts, image buffers, and WebSocket gateways
    const csp = "default-src 'self'; " +
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                "font-src 'self' https://fonts.gstatic.com; " +
                "img-src 'self' data: blob:; " +
                "connect-src 'self' ws: wss:;";
    res.setHeader('Content-Security-Policy', csp);
    next();
  });

  // ==========================================
  // REGISTER RATE LIMITS (Finding #1)
  // ==========================================
  // Throttle onboarding setup wizard
  expressApp.use('/api/setup', rateLimitMiddleware(10, 60 * 60 * 1000)); // 10 attempts/hour
  
  // Throttle logins (NextAuth) and credentials check
  expressApp.use('/api/auth', rateLimitMiddleware(30, 60 * 1000)); // 30 attempts/minute
  
  // Throttle MFA configurations
  expressApp.use('/api/profile/mfa', rateLimitMiddleware(10, 60 * 1000)); // 10 attempts/minute

  // Initialize WebSocket Server attached to the shared HTTP server
  const wss = new WebSocketServer({ noServer: true });

  // Session registry tracking active connections globally
  const activeSessions = new Map<string, { ws: WebSocket; username: string; host: string; startedAt: Date }>();

  // Expose session count for administration panel / overview card
  (globalThis as any).activeSSHCount = () => activeSessions.size;
  (globalThis as any).getActiveSessions = () => Array.from(activeSessions.entries()).map(([id, s]) => ({
    sessionId: id,
    username: s.username,
    host: s.host,
    startedAt: s.startedAt,
  }));

  // Handle WebSocket connections
  wss.on('connection', async (ws: WebSocket, request) => {
    const url = request.url || '';
    const parsedUrl = parse(url, true);
    const query = parsedUrl.query;
    
    const connectionId = query.connectionId as string;
    const initialCols = parseInt(query.cols as string, 10) || 80;
    const initialRows = parseInt(query.rows as string, 10) || 24;

    const sessionId = Math.random().toString(36).substring(2, 9);
    let sshClient: any = null;
    let shellStream: any = null;
    let isHandshakeComplete = false;

    // 5-second handshaking watchdog protection against TCP half-open socket leaks (Finding #5)
    const handshakeTimeout = setTimeout(() => {
      if (!isHandshakeComplete) {
        console.warn(`[WS-SSH] Handshake timed out. Terminating session ID ${sessionId}.`);
        ws.send(`\r\n\x1b[31m[Pillar Gateway Error] Connection handshake timed out.\x1b[0m\r\n`);
        ws.close(1008, 'Handshake timed out');
      }
    }, 5000);

    try {
      // 1. Authenticate WS Upgrade request using NextAuth session cookies (Gotcha #8)
      const cookies = parseCookies(request.headers.cookie || '');
      const cookieName = cookies['authjs.session-token'] ? 'authjs.session-token' : '__Secure-authjs.session-token';
      const sessionToken = cookies[cookieName];

      if (!sessionToken) {
        throw new Error('UNAUTHORIZED: No active gateway session found.');
      }

      // Decode NextAuth JWT token
      const decodedUser = await decode({
        token: sessionToken,
        secret: process.env.NEXTAUTH_SECRET!,
        salt: cookieName,
      });

      if (!decodedUser || !decodedUser.id) {
        throw new Error('UNAUTHORIZED: Session token is invalid or expired.');
      }

      // 2. Fetch the connection record from DB and execute ownership scopes checks (Security mandate #3)
      if (!connectionId) {
        throw new Error('BAD_REQUEST: Missing required parameter connectionId.');
      }

      const connection = await db.connection.findUnique({
        where: { id: connectionId },
        include: { sharedWith: true },
      });

      if (!connection) {
        throw new Error('NOT_FOUND: SSH Connection profile not found.');
      }

      // Enforce BOLA checks: connection must belong to user OR be explicitly shared
      const isOwner = connection.userId === decodedUser.id;
      const isShared = connection.sharedWith.some((share) => share.userId === decodedUser.id);

      if (!isOwner && !isShared) {
        throw new Error('FORBIDDEN: You do not have permissions to load this connection profile.');
      }

      console.log(`[WS-SSH] Auth Succeeded. User: ${decodedUser.email} -> Host: ${connection.host}:${connection.port}`);

      // 3. Decrypt secrets at runtime only (Security Mandate #1 - never stored in persistent global state)
      const password = connection.password ? decrypt(connection.password) : null;
      const privateKey = connection.privateKey ? decrypt(connection.privateKey) : null;
      const passphrase = connection.passphrase ? decrypt(connection.passphrase) : null;

      // Log session in registry
      activeSessions.set(sessionId, {
        ws,
        username: decodedUser.email || 'unknown',
        host: connection.host,
        startedAt: new Date(),
      });

      // Write Audit Log entry
      const ip = (request.headers['x-forwarded-for'] as string || request.socket.remoteAddress || '').split(',')[0].trim();
      await writeAudit(
        decodedUser.id as string,
        'SSH Session Initializing',
        ip,
        { connectionId: connection.id, name: connection.name, host: connection.host }
      );

      // Disable watchdog trigger: handshake completed successfully
      clearTimeout(handshakeTimeout);
      isHandshakeComplete = true;

      // 4. Connect to remote node using our connection factory
      sshClient = await connectSSH({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        authType: connection.authType as 'PASSWORD' | 'KEY',
        password,
        privateKey,
        passphrase,
      });

      // 5. Establish interactive terminal shell (pty)
      sshClient.shell({
        term: 'xterm-256color',
        cols: initialCols,
        rows: initialRows,
      }, (err: any, stream: any) => {
        if (err) {
          console.error('[WS-SSH] Failed to initiate shell:', err);
          ws.send(`\r\n\x1b[31m[Pillar Gateway Error] Failed to launch remote shell: ${err.message}\x1b[0m\r\n`);
          ws.close();
          return;
        }

        shellStream = stream;

        // Stream output from remote SSH shell to browser terminal (ws)
        shellStream.on('data', (data: any) => {
          ws.send(data);
        });

        shellStream.on('close', () => {
          console.log(`[WS-SSH] Remote shell closed. Session: ${sessionId}`);
          ws.close();
        });
      });

      // Handle keystrokes and control directives from browser terminal
      ws.on('message', (message) => {
        const payload = message.toString();

        // Check if message is a resize control directive
        if (payload.startsWith('{"type":"resize"')) {
          try {
            const parsed = JSON.parse(payload);
            if (shellStream && parsed.cols && parsed.rows) {
              shellStream.setWindow(parsed.rows, parsed.cols, 0, 0);
            }
          } catch (e) {
            console.error('[WS-SSH] Error parsing resize notification:', e);
          }
        } else {
          // Otherwise pipe raw browser keystrokes to SSH PTY stdin
          if (shellStream) {
            shellStream.write(message);
          }
        }
      });

      ws.on('close', async () => {
        console.log(`[WS-SSH] Web Client disconnected. Session: ${sessionId}`);
        
        // Clean up connections
        if (shellStream) shellStream.end();
        if (sshClient) sshClient.end();
        
        activeSessions.delete(sessionId);

        await writeAudit(
          decodedUser.id as string,
          'SSH Session Closed',
          ip,
          { connectionId: connection.id, name: connection.name, host: connection.host }
        );
      });

      ws.on('error', (err) => {
        console.error(`[WS-SSH] Session ${sessionId} Socket Error:`, err);
      });

    } catch (err: any) {
      clearTimeout(handshakeTimeout); // disable timeout on immediate caught failures
      console.error('[WS-SSH] Initialization failed:', err.message);
      // Send error format directly in terminal-escaped coloring so it renders cleanly in xterm.js!
      ws.send(`\r\n\x1b[31m[Pillar Gateway Error] Handshake failed: ${err.message}\x1b[0m\r\n`);
      ws.close(1008, err.message);
      
      if (sshClient) sshClient.end();
      activeSessions.delete(sessionId);
    }
  });

  // Intercept HTTP server 'upgrade' requests to authorize and route to WebSocket Server
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '', true);

    // Only handle upgrades on the dedicated /api/ws/terminal path
    if (pathname === '/api/ws/terminal') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Pass all standard requests (HTML pages, APIs, statics) directly to Next.js handler (Catch-all middleware)
  expressApp.use((req, res) => {
    const parsedUrl = parse(req.url, true);
    return handle(req, res, parsedUrl);
  });

  // Start the server listening on the configured port
  server.listen(port, () => {
    console.log(`\n🚀 Pillar remote-access gateway running in [${process.env.NODE_ENV || 'development'}] mode.`);
    console.log(`👉 http://localhost:${port}\n`);
  });
}).catch((err) => {
  console.error('Fatal: Failed to prepare Next.js application framework.', err);
  process.exit(1);
});
