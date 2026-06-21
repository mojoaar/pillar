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
import net from 'net';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js app instance (Webpack dev runner for absolute custom server stability)
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
    
    // Only apply strict Content Security Policy in production to prevent blocking
    // Next.js hot module reloading (HMR) and dev assets in development mode (Finding #csp-dev)
    if (process.env.NODE_ENV === 'production') {
      const csp = "default-src 'self'; " +
                  "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
                  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
                  "font-src 'self' https://fonts.gstatic.com; " +
                  "img-src 'self' data: blob:; " +
                  "connect-src 'self' ws: wss:;";
      res.setHeader('Content-Security-Policy', csp);
    }
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

  // Initialize Web Socket Servers
  const wss = new WebSocketServer({ noServer: true });
  const wssVnc = new WebSocketServer({ noServer: true });

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

  // ==========================================
  // 1. WEBSOCKET SSH HANDLER (Phase 4)
  // ==========================================
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

      // Enforce BOLA checks
      const isOwner = connection.userId === decodedUser.id;
      const isShared = connection.sharedWith.some((share) => share.userId === decodedUser.id);

      if (!isOwner && !isShared) {
        throw new Error('FORBIDDEN: You do not have permissions to load this connection profile.');
      }

      // Decrypt secrets
      const password = connection.password ? decrypt(connection.password) : null;
      const privateKey = connection.privateKey ? decrypt(connection.privateKey) : null;
      const passphrase = connection.passphrase ? decrypt(connection.passphrase) : null;

      // Log session
      activeSessions.set(sessionId, {
        ws,
        username: decodedUser.email || 'unknown',
        host: connection.host,
        startedAt: new Date(),
      });

      // Write Audit Log
      const ip = (request.headers['x-forwarded-for'] as string || request.socket.remoteAddress || '').split(',')[0].trim();
      await writeAudit(
        decodedUser.id as string,
        'SSH Session Initializing',
        ip,
        { connectionId: connection.id, name: connection.name, host: connection.host }
      );

      // Disable watchdog trigger
      clearTimeout(handshakeTimeout);
      isHandshakeComplete = true;

      // Connect to remote node
      sshClient = await connectSSH({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        authType: connection.authType as 'PASSWORD' | 'KEY',
        password,
        privateKey,
        passphrase,
      });

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

        shellStream.on('data', (data: any) => {
          ws.send(data);
        });

        shellStream.on('close', () => {
          console.log(`[WS-SSH] Remote shell closed. Session: ${sessionId}`);
          ws.close();
        });
      });

      ws.on('message', (message) => {
        const payload = message.toString();

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
          if (shellStream) {
            shellStream.write(message);
          }
        }
      });

      ws.on('close', async () => {
        console.log(`[WS-SSH] Web Client disconnected. Session: ${sessionId}`);
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

    } catch (err: any) {
      clearTimeout(handshakeTimeout);
      console.error('[WS-SSH] Initialization failed:', err.message);
      ws.send(`\r\n\x1b[31m[Pillar Gateway Error] Handshake failed: ${err.message}\x1b[0m\r\n`);
      ws.close(1008, err.message);
      if (sshClient) sshClient.end();
      activeSessions.delete(sessionId);
    }
  });

  // ==========================================
  // 2. WEBSOCKET VNC TO TCP PROXY (Phase 9)
  // ==========================================
  wssVnc.on('connection', async (ws: WebSocket, request) => {
    const url = request.url || '';
    const parsedUrl = parse(url, true);
    const query = parsedUrl.query;
    
    const connectionId = query.connectionId as string;
    const sessionId = Math.random().toString(36).substring(2, 9);
    
    let tcpClient: net.Socket | null = null;
    let isHandshakeComplete = false;

    // Handshaking watchdog timeout
    const handshakeTimeout = setTimeout(() => {
      if (!isHandshakeComplete) {
        console.warn(`[WS-VNC] Handshake timed out. Terminating session ID ${sessionId}.`);
        ws.close(1008, 'Handshake timed out');
      }
    }, 5000);

    try {
      const cookies = parseCookies(request.headers.cookie || '');
      const cookieName = cookies['authjs.session-token'] ? 'authjs.session-token' : '__Secure-authjs.session-token';
      const sessionToken = cookies[cookieName];

      if (!sessionToken) {
        throw new Error('UNAUTHORIZED: No active gateway session.');
      }

      const decodedUser = await decode({
        token: sessionToken,
        secret: process.env.NEXTAUTH_SECRET!,
        salt: cookieName,
      });

      if (!decodedUser || !decodedUser.id) {
        throw new Error('UNAUTHORIZED: Token invalid.');
      }

      if (!connectionId) {
        throw new Error('BAD_REQUEST: Missing connectionId.');
      }

      const connection = await db.connection.findUnique({
        where: { id: connectionId },
        include: { sharedWith: true },
      });

      if (!connection || connection.protocol !== 'VNC') {
        throw new Error('NOT_FOUND: VNC profile not found.');
      }

      // Enforce BOLA checks
      const isOwner = connection.userId === decodedUser.id;
      const isShared = connection.sharedWith.some((share) => share.userId === decodedUser.id);

      if (!isOwner && !isShared) {
        throw new Error('FORBIDDEN: Scope violation.');
      }

      console.log(`[WS-VNC] Auth Succeeded. User: ${decodedUser.email} -> VNC: ${connection.host}:${connection.port}`);

      // Log session
      activeSessions.set(sessionId, {
        ws,
        username: decodedUser.email || 'unknown',
        host: `${connection.host} (VNC)`,
        startedAt: new Date(),
      });

      // Write Audit Log
      const ip = (request.headers['x-forwarded-for'] as string || request.socket.remoteAddress || '').split(',')[0].trim();
      await writeAudit(
        decodedUser.id as string,
        'VNC Session Initializing',
        ip,
        { connectionId: connection.id, name: connection.name, host: connection.host }
      );

      clearTimeout(handshakeTimeout);
      isHandshakeComplete = true;

      // Establish raw TCP VNC connection to target node (default port 5900)
      tcpClient = net.createConnection({
        host: connection.host,
        port: connection.port || 5900,
      });

      // Pipe VNC TCP socket outputs directly to Browser Websocket
      tcpClient.on('data', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data, { binary: true });
        }
      });

      // Pipe Browser Websocket inputs directly to VNC TCP socket
      ws.on('message', (message) => {
        if (tcpClient && !tcpClient.destroyed) {
          tcpClient.write(message as Buffer);
        }
      });

      tcpClient.on('error', (err) => {
        console.error('[WS-VNC] Remote TCP VNC Socket Error:', err.message);
        ws.send(JSON.stringify({ error: `VNC Connection failed: ${err.message}` }));
        ws.close();
      });

      tcpClient.on('close', () => {
        console.log(`[WS-VNC] Remote VNC target socket closed. Session: ${sessionId}`);
        ws.close();
      });

      ws.on('close', async () => {
        console.log(`[WS-VNC] Web Client disconnected. Session: ${sessionId}`);
        if (tcpClient) tcpClient.destroy();
        activeSessions.delete(sessionId);

        await writeAudit(
          decodedUser.id as string,
          'VNC Session Closed',
          ip,
          { connectionId: connection.id, name: connection.name, host: connection.host }
        );
      });

    } catch (err: any) {
      clearTimeout(handshakeTimeout);
      console.error('[WS-VNC] Handshake crashed:', err.message);
      ws.close(1008, err.message);
      if (tcpClient) tcpClient.destroy();
      activeSessions.delete(sessionId);
    }
  });

  // Intercept HTTP server 'upgrade' requests to authorize and route to correct WebSocket Server
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '', true);

    if (pathname === '/api/ws/terminal') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else if (pathname === '/api/ws/vnc') {
      wssVnc.handleUpgrade(request, socket, head, (ws) => {
        wssVnc.emit('connection', ws, request);
      });
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
