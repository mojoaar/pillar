import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import next from 'next';
import { decode } from 'next-auth/jwt';
import { db } from './src/lib/db';
import { decrypt } from './src/lib/crypto';
import { connectSSH } from './src/lib/ssh';
import { writeAudit } from './src/lib/audit';
import net from 'net';
// Gotcha #url-parse: Next.js's getRequestHandler expects NextUrlWithParsedQuery from url.parse().
// All WebSocket handlers use our WHATWG parseUrl() helper instead. Suppress the deprecation warning.
import { parse } from 'url';
import { sessionRegistry } from './src/lib/sessions';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js app instance (Webpack dev runner for absolute custom server stability)
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// WHATWG URL helper replacing deprecated url.parse()
function parseUrl(raw: string) {
  try {
    const u = new URL(raw, 'http://localhost');
    const params: Record<string, string> = {};
    u.searchParams.forEach((v, k) => { params[k] = v; });
    return { pathname: u.pathname, query: params };
  } catch {
    return { pathname: '/', query: {} as Record<string, string> };
  }
}

// Helper to parse cookies from header
function parseCookies(cookieHeader: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      try {
        list[name] = decodeURIComponent(parts.join('='));
      } catch {
        // Skip malformed cookie values gracefully
      }
    }
  });
  return list;
}

// Helper to construct Apache Guacamole protocol instruction strings
// Sanitizes args by stripping protocol delimiters to prevent injection
function guacInstruction(opcode: string, ...args: string[]): string {
  const sanitize = (s: string) => s.replace(/[;]/g, '');
  const list = [sanitize(opcode), ...args.map(sanitize)];
  return list.map((a) => `${a.length}.${a}`).join(',') + ';';
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

// Periodic cleanup: sweep expired rate-limiter entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitBuckets) {
    const recent = timestamps.filter((t) => t > now - 3600000); // 1 hour max window
    if (recent.length === 0) {
      rateLimitBuckets.delete(key);
    } else {
      rateLimitBuckets.set(key, recent);
    }
  }
}, 5 * 60 * 1000).unref();

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
  expressApp.set('trust proxy', 1);
  const server = http.createServer(expressApp);

  // Validate NEXTAUTH_SECRET at startup and cache for all WS handlers
  if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
    throw new Error('NEXTAUTH_SECRET must be at least 32 characters.');
  }
  const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

  // ==========================================
  // HTTP SECURITY HEADERS MIDDLEWARE (Finding #3)
  // ==========================================
  expressApp.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    
    // Only apply strict Content Security Policy in production to prevent blocking
    // Next.js hot module reloading (HMR) and dev assets in development mode (Finding #csp-dev)
    if (process.env.NODE_ENV === 'production') {
      const csp = "default-src 'self'; " +
                  "script-src 'self' 'unsafe-inline'; " +
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
  const wssRdp = new WebSocketServer({ noServer: true });

  // Persistent SSH Session Registry supporting Resumable Connections (Finding #resumable)
  // Maps "userId:connectionId" to a single persistent SSH client and running shell stream
  const persistentSshSessions = new Map<string, {
    sshClient: any;
    shellStream: any;
    activeSockets: Set<WebSocket>;
    disconnectTimeout?: NodeJS.Timeout;
    cols: number;
    rows: number;
    listeners: Map<WebSocket, (data: any) => void>;
    sessionId?: string;
  }>();

  // activeSessions Map is now managed through sessionRegistry module (lib/sessions.ts)

  // ==========================================
  // 1. WEBSOCKET SSH HANDLER (Phase 4 & Finding #resumable)
  // ==========================================
  wss.on('connection', async (ws: WebSocket, request) => {
    const url = request.url || '';
    const parsedUrl = parseUrl(url);
    const query = parsedUrl.query;
    
    const connectionId = query.connectionId as string;
    const initialCols = parseInt(query.cols as string, 10) || 80;
    const initialRows = parseInt(query.rows as string, 10) || 24;

    const sessionId = Math.random().toString(36).substring(2, 9);
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
        secret: NEXTAUTH_SECRET,
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

      // Clear handshake watchdog
      clearTimeout(handshakeTimeout);
      isHandshakeComplete = true;

      // Calculate the unique persistent session key (Scope isolated per-user!)
      const sessionKey = `${decodedUser.id}:${connectionId}`;
      let session = persistentSshSessions.get(sessionKey);

      // Extract client IP address securely
      const ip = (request.headers['x-forwarded-for'] as string || request.socket.remoteAddress || '').split(',')[0].trim();

      // ==========================================
      // CASE A: SESSION ALREADY RUNNING (RESUME)
      // ==========================================
      if (session) {
        try {
          console.log(`[WS-SSH] Resuming active persistent SSH session: ${sessionKey}`);
          
          // Cancel pending disconnect timeout
          if (session.disconnectTimeout) {
            clearTimeout(session.disconnectTimeout);
            session.disconnectTimeout = undefined;
          }

          // Force-terminate any previous active "ghost" sockets for this session to prevent duplicate display lags (Finding #session-cleanup)
          session.activeSockets.forEach((oldSocket) => {
            if (oldSocket !== ws && (oldSocket.readyState === WebSocket.OPEN || oldSocket.readyState === WebSocket.CONNECTING)) {
              console.log(`[WS-SSH] Closing duplicate active socket for persistent key: ${sessionKey}`);
              oldSocket.close(1000, 'Re-established session in another tab');
            }
          });
          session.activeSockets.clear();

          // Clean up the old session ID from sessionRegistry before mapping the new resumed one
          if (session.sessionId) {
            sessionRegistry.delete(session.sessionId);
          }
          session.sessionId = sessionId;

          // Add new socket to active list
          session.activeSockets.add(ws);
          
          // Expose session in active registry
          sessionRegistry.set(sessionId, {
            ws,
            username: decodedUser.email || 'unknown',
            host: connection.host,
            startedAt: new Date(),
            connectionId: connection.id,
            protocol: 'SSH',
          });

          // Write brief re-attach logs
          ws.send('\r\n\x1b[32m[Pillar Gateway] Re-attaching to running terminal session...\x1b[0m\r\n');

          // Dynamically refit to the user's current window size
          if (session.shellStream) {
            session.shellStream.setWindow(initialRows, initialCols, 0, 0);
          }

          // Set up the duplex bridge handlers
          const dataHandler = (data: any) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(data);
            }
          };

          session.shellStream.on('data', dataHandler);
          session.listeners.set(ws, dataHandler);

          ws.on('message', (message) => {
            const payload = message.toString();
            if (payload.startsWith('{"type":"resize"')) {
              try {
                const parsed = JSON.parse(payload);
                if (session && session.shellStream && parsed.cols && parsed.rows) {
                  session.shellStream.setWindow(parsed.rows, parsed.cols, 0, 0);
                }
              } catch (e) {}
            } else {
              if (session && session.shellStream) {
                session.shellStream.write(message);
              }
            }
          });

          ws.on('close', async (code, reason) => {
            const reasonStr = reason?.toString() || '';
            const isPermanent = reasonStr === 'terminate';
            console.log(`[WS-SSH] Web client disconnected from resumed session ID ${sessionId}. permanent=${isPermanent}`);
            
            if (isPermanent) {
              sessionRegistry.delete(sessionId);
            } else {
              // Update session in registry to show background state
              const allSess = sessionRegistry.getAll();
              const current = allSess.find((s) => s.sessionId === sessionId);
              if (current) {
                sessionRegistry.set(sessionId, {
                  ws: null,
                  username: current.username,
                  host: `${current.host.replace(' (Background)', '')} (Background)`,
                  startedAt: current.startedAt,
                  connectionId: current.connectionId,
                  protocol: current.protocol,
                });
              }
            }
            
            if (session) {
              // Clean up listeners for this socket
              const handler = session.listeners.get(ws);
              if (handler) {
                session.shellStream.off('data', handler);
                session.listeners.delete(ws);
              }
              session.activeSockets.delete(ws);

              if (isPermanent) {
                console.log(`[WS-SSH] Permanent termination requested. Closing session: ${sessionKey}`);
                try { session.shellStream.end(); } catch (e) {}
                try { session.sshClient.end(); } catch (e) {}
                persistentSshSessions.delete(sessionKey);
              } else if (session.activeSockets.size === 0) {
                console.log(`[WS-SSH] Session ${sessionKey} is idle. Starting 5-minute persistent watchdog.`);
                
                session.disconnectTimeout = setTimeout(() => {
                  console.log(`[WS-SSH] Watchdog elapsed. Terminating persistent idle SSH session: ${sessionKey}`);
                  try {
                    if (session.shellStream) session.shellStream.end();
                  } catch (e) {}
                  try {
                    if (session.sshClient) session.sshClient.end();
                  } catch (e) {}
                  persistentSshSessions.delete(sessionKey);
                  sessionRegistry.delete(sessionId); // clean registry
                }, 5 * 60 * 1000); // Keep terminal alive on the server for 5 minutes!
              }
            }
          });

          return; // Success, terminate handler
        } catch (resumeErr: any) {
          console.warn(`[WS-SSH] Failed to resume stale persistent session ${sessionKey}:`, resumeErr.message);
          // Gracefully clean up the dead/stale session components
          try {
            if (session.shellStream) session.shellStream.end();
            if (session.sshClient) session.sshClient.end();
          } catch (e) {}
          persistentSshSessions.delete(sessionKey);
          // Fall through to CASE B below to establish a fresh, healthy SSH stream!
        }
      }

      // ==========================================
      // CASE B: FIRST-TIME CONNECTION (ESTABLISH)
      // ==========================================
      console.log(`[WS-SSH] Establishing fresh SSH session: ${sessionKey}`);

      const password = connection.password ? decrypt(connection.password) : null;
      const privateKey = connection.privateKey ? decrypt(connection.privateKey) : null;
      const passphrase = connection.passphrase ? decrypt(connection.passphrase) : null;

      // Connect to remote node
      const sshClient = await connectSSH({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        authType: connection.authType as 'PASSWORD' | 'KEY',
        password,
        privateKey,
        passphrase,
      });

      // CRITICAL HANDSHAKE RACE GUARD: If the browser closed the WebSocket while SSH was handshaking,
      // terminate the SSH connection immediately and abort setup (Finding #race-guard)
      if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        console.log(`[WS-SSH] Aborting setup. Browser WebSocket closed during SSH handshake.`);
        sshClient.end();
        return;
      }

      // Launch interactive shell
      sshClient.shell({
        term: 'xterm-256color',
        cols: initialCols,
        rows: initialRows,
      }, (err: any, stream: any) => {
        if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          console.log(`[WS-SSH] Aborting shell stream setup. Browser WebSocket closed.`);
          if (stream) stream.end();
          sshClient.end();
          return;
        }

        if (err) {
          console.error('[WS-SSH] Failed to initiate shell stream:', err);
          ws.send(`\r\n\x1b[31m[Pillar Gateway Error] Failed to launch remote shell: ${err.message}\x1b[0m\r\n`);
          ws.close();
          return;
        }

        const shellStream = stream;

        // Create persistent session configuration entry
        const sessionEntry = {
          sshClient,
          shellStream,
          activeSockets: new Set<WebSocket>([ws]),
          cols: initialCols,
          rows: initialRows,
          listeners: new Map<WebSocket, (data: any) => void>(),
          sessionId,
        };

        persistentSshSessions.set(sessionKey, sessionEntry);

        // Map active sessions
        sessionRegistry.set(sessionId, {
          ws,
          username: decodedUser.email || 'unknown',
          host: connection.host,
          startedAt: new Date(),
          connectionId: connection.id,
          protocol: 'SSH',
        });

        // Set up standard data handlers
        const dataHandler = (data: any) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        };

        shellStream.on('data', dataHandler);
        sessionEntry.listeners.set(ws, dataHandler);

        // Write Audit log
        writeAudit(
          decodedUser.id as string,
          'SSH Session Started',
          ip,
          { connectionId: connection.id, name: connection.name, host: connection.host }
        );

        shellStream.on('close', () => {
          console.log(`[WS-SSH] Persistent remote shell closed by host: ${sessionKey}`);
          
          // Force close any active sockets connected to this session
          const activeSess = persistentSshSessions.get(sessionKey);
          if (activeSess) {
            activeSess.activeSockets.forEach((socket) => {
              socket.close(1000, 'Remote shell closed');
            });
            persistentSshSessions.delete(sessionKey);
          }
        });

        ws.on('message', (message) => {
          const payload = message.toString();
          if (payload.startsWith('{"type":"resize"')) {
            try {
              const parsed = JSON.parse(payload);
              if (parsed.cols && parsed.rows) {
                shellStream.setWindow(parsed.rows, parsed.cols, 0, 0);
              }
            } catch (e) {}
          } else {
            shellStream.write(message);
          }
        });

        ws.on('close', async (code, reason) => {
          const reasonStr = reason?.toString() || '';
          const isPermanent = reasonStr === 'terminate';
          console.log(`[WS-SSH] Web client disconnected from fresh session ID ${sessionId}. permanent=${isPermanent}`);
          
          if (isPermanent) {
            sessionRegistry.delete(sessionId);
          } else {
            // Update session in registry to show background state
            const allSess = sessionRegistry.getAll();
            const current = allSess.find((s) => s.sessionId === sessionId);
            if (current) {
              sessionRegistry.set(sessionId, {
                ws: null,
                username: current.username,
                host: `${current.host.replace(' (Background)', '')} (Background)`,
                startedAt: current.startedAt,
                connectionId: current.connectionId,
                protocol: 'SSH',
              });
            }
          }
          
          const activeSess = persistentSshSessions.get(sessionKey);
          if (activeSess) {
            const handler = activeSess.listeners.get(ws);
            if (handler) {
              shellStream.off('data', handler);
              activeSess.listeners.delete(ws);
            }
            activeSess.activeSockets.delete(ws);

            if (isPermanent) {
              console.log(`[WS-SSH] Permanent termination requested. Closing session: ${sessionKey}`);
              try { shellStream.end(); } catch (e) {}
              try { sshClient.end(); } catch (e) {}
              persistentSshSessions.delete(sessionKey);
            } else if (activeSess.activeSockets.size === 0) {
              console.log(`[WS-SSH] Session ${sessionKey} is idle. Starting 5-minute persistent watchdog.`);
              
              activeSess.disconnectTimeout = setTimeout(() => {
                console.log(`[WS-SSH] Watchdog elapsed. Terminating persistent idle SSH session: ${sessionKey}`);
                try { shellStream.end(); } catch (e) {}
                try { sshClient.end(); } catch (e) {}
                persistentSshSessions.delete(sessionKey);
                sessionRegistry.delete(sessionId); // clean registry
              }, 5 * 60 * 1000);
            }
          }
        });
      });

    } catch (err: any) {
      clearTimeout(handshakeTimeout);
      console.error('[WS-SSH] Initialization failed:', err.message);
      ws.send(`\r\n\x1b[31m[Pillar Gateway Error] Handshake failed: ${err.message}\x1b[0m\r\n`);
      ws.close(1008, err.message);
      sessionRegistry.delete(sessionId);
    }
  });

  // ==========================================
  // 2. WEBSOCKET VNC TO TCP PROXY (Phase 9)
  // ==========================================
  wssVnc.on('connection', async (ws: WebSocket, request) => {
    const url = request.url || '';
    const parsedUrl = parseUrl(url);
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
        secret: NEXTAUTH_SECRET,
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
      sessionRegistry.set(sessionId, {
        ws,
        username: decodedUser.email || 'unknown',
        host: `${connection.host} (VNC)`,
        startedAt: new Date(),
        connectionId: connection.id,
        protocol: 'VNC',
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
      tcpClient.setKeepAlive(true, 10000);

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
        sessionRegistry.delete(sessionId);

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
      sessionRegistry.delete(sessionId);
    }
  });

  // ==========================================
  // 3. WEBSOCKET RDP PROTOCOL GATEWAY (Phase 10)
  // ==========================================
  wssRdp.on('connection', async (ws: WebSocket, request) => {
    const url = request.url || '';
    const parsedUrl = parseUrl(url);
    const query = parsedUrl.query;
    
    const connectionId = query.connectionId as string;
    const sessionId = Math.random().toString(36).substring(2, 9);
    
    let guacdClient: net.Socket | null = null;
    let isHandshakeComplete = false;

    // Handshaking watchdog timeout
    const handshakeTimeout = setTimeout(() => {
      if (!isHandshakeComplete) {
        console.warn(`[WS-RDP] Handshake timed out. Terminating session ID ${sessionId}.`);
        ws.close(1008, 'Handshake timed out');
      }
    }, 5000);

    try {
      const cookies = parseCookies(request.headers.cookie || '');
      const cookieName = cookies['authjs.session-token'] ? 'authjs.session-token' : '__Secure-authjs.session-token';
      const sessionToken = cookies[cookieName];

      if (!sessionToken) {
        throw new Error('UNAUTHORIZED: No active session.');
      }

      const decodedUser = await decode({
        token: sessionToken,
        secret: NEXTAUTH_SECRET,
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

      if (!connection || connection.protocol !== 'RDP') {
        throw new Error('NOT_FOUND: RDP profile not found.');
      }

      // Enforce BOLA checks
      const isOwner = connection.userId === decodedUser.id;
      const isShared = connection.sharedWith.some((share) => share.userId === decodedUser.id);

      if (!isOwner && !isShared) {
        throw new Error('FORBIDDEN: Scope violation.');
      }

      console.log(`[WS-RDP] Auth Succeeded. User: ${decodedUser.email} -> RDP: ${connection.host}:${connection.port}`);

      // Log session
      sessionRegistry.set(sessionId, {
        ws,
        username: decodedUser.email || 'unknown',
        host: `${connection.host} (RDP)`,
        startedAt: new Date(),
        connectionId: connection.id,
        protocol: 'RDP',
      });

      // Write Audit Log
      const ip = (request.headers['x-forwarded-for'] as string || request.socket.remoteAddress || '').split(',')[0].trim();
      await writeAudit(
        decodedUser.id as string,
        'RDP Session Initializing',
        ip,
        { connectionId: connection.id, name: connection.name, host: connection.host }
      );

      clearTimeout(handshakeTimeout);
      isHandshakeComplete = true;

      // Resolve guacd sidecar configurations
      const guacdHost = process.env.GUACD_HOST || 'localhost';
      const guacdPort = Number(process.env.GUACD_PORT) || 4822;

      // Connect to Guacamole Daemon sidecar container (Finding #guac-tunnel)
      guacdClient = net.createConnection({
        host: guacdHost,
        port: guacdPort,
      });
      guacdClient.setKeepAlive(true, 10000);

      // Determine per-connection cert verification: configurable via connection schema field
      const ignoreRdpCert = connection.ignoreCert;
      const decryptedPassword = connection.password ? decrypt(connection.password) : '';

      // Parse screen size details dynamically
      const rdpScreenSize = (connection as any).screenSize || '1024x768';
      const [rdpWidth, rdpHeight] = rdpScreenSize.split('x');

      const rdpSecurity = (connection as any).rdpSecurity || 'any';

      // Clean local/Workgroup credentials: if domain is blank and username has "\", split it
      let rdpDomain = connection.domain || '';
      let rdpUsername = connection.username;
      if (!rdpDomain && rdpUsername.includes('\\')) {
        const domainParts = rdpUsername.split('\\');
        rdpDomain = domainParts[0];
        rdpUsername = domainParts[1] || '';
      }

      // Initialize state variables for Guacamole Handshake Protocol negotiation
      let handshook = false;

      guacdClient.on('connect', () => {
        // Send initial protocol select instruction
        if (guacdClient && !guacdClient.destroyed) {
          guacdClient.write(guacInstruction('select', 'rdp'));
        }
      });

      // Handle raw stream buffering and handshake parser
      guacdClient.on('data', (data) => {
        const payload = data.toString();

        if (!handshook) {
          // If receiving args list, compile the connect instruction block
          if (payload.startsWith('4.args,')) {
            // Simple parsing to split raw instructions: e.g. "4.args,8.hostname,4.port;"
            // Extracts all supported arg names dynamically
            const argsList: string[] = [];
            const parts = payload.substring(7, payload.length - 1).split(',');
            
            parts.forEach((p) => {
              const dotIdx = p.indexOf('.');
              if (dotIdx !== -1) {
                argsList.push(p.substring(dotIdx + 1));
              }
            });

            // Map connection arguments to the matching guacd instruction parameters
            const argValues = argsList.map((argName) => {
              if (argName.startsWith('VERSION_')) return '';
              if (argName === 'hostname') return connection.host;
              if (argName === 'port') return (connection.port || 3389).toString();
              if (argName === 'username') return rdpUsername;
              if (argName === 'password') return decryptedPassword;
              if (argName === 'domain') return rdpDomain;
              if (argName === 'security') return rdpSecurity;
              if (argName === 'ignore-cert') return ignoreRdpCert ? 'true' : 'false';
              if (argName === 'width') return rdpWidth || '1024';
              if (argName === 'height') return rdpHeight || '768';
              if (argName === 'dpi') return '96';
              if (argName === 'color-depth') return '24';
              if (argName === 'client-name') return 'Pillar';
              return ''; // all other parameters blank
            });

            // Send standard connect instruction to finalize handshake (exactly matching args length)
            const inst = guacInstruction('connect', ...argValues);

            // Send complete Guacamole protocol handshake steps (size, audio, video, image) before connect
            if (guacdClient && !guacdClient.destroyed) {
              guacdClient.write(guacInstruction('size', rdpWidth || '1024', rdpHeight || '768', '96'));
              guacdClient.write(guacInstruction('audio', 'audio/L8', 'audio/L16'));
              guacdClient.write(guacInstruction('video'));
              guacdClient.write(guacInstruction('image', 'image/png', 'image/jpeg'));
              guacdClient.write(inst);
              handshook = true;
            }
          }
        } else {
          // Once handshake is completed, forward all stream outputs directly to WebSocket
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
          }
        }
      });

      // Forward WebSocket inputs back to the guacd TCP Client immediately to preserve handshake messages like size
      ws.on('message', (message) => {
        if (guacdClient && !guacdClient.destroyed) {
          guacdClient.write(message.toString());
        }
      });

      guacdClient.on('error', (err) => {
        console.error('[WS-RDP] Guacamole TCP Socket error:', err.message);
        ws.send(guacInstruction('error', 'Guacamole daemon error', '1'));
        ws.close();
      });

      guacdClient.on('close', () => {
        console.log(`[WS-RDP] Guacamole sidecar closed target tunnel. Session: ${sessionId}`);
        ws.close();
      });

      ws.on('close', async () => {
        console.log(`[WS-RDP] Web Client disconnected from RDP. Session: ${sessionId}`);
        if (guacdClient) guacdClient.destroy();
        sessionRegistry.delete(sessionId);

        await writeAudit(
          decodedUser.id as string,
          'RDP Session Closed',
          ip,
          { connectionId: connection.id, name: connection.name, host: connection.host }
        );
      });

    } catch (err: any) {
      clearTimeout(handshakeTimeout);
      console.error('[WS-RDP] Handshake crashed:', err.message);
      ws.close(1008, err.message);
      if (guacdClient) guacdClient.destroy();
      sessionRegistry.delete(sessionId);
    }
  });

  // ==========================================
  // 4. WEBSOCKET PROXMOX VE VNC PROXY GATEWAY (Phase 11 Extension - Removed)
  // ==========================================

  // Intercept HTTP server 'upgrade' requests — validate Origin and session cookie BEFORE upgrading
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parseUrl(request.url || '');
    console.log(`[WS Upgrade Request] path=${pathname} url=${request.url}`);

    // Only apply strict Origin and session validation on our custom WebSocket API routes,
    // allowing Next.js HMR WebSocket connections (/_next/webpack-hmr) to bypass safely (Finding #hmr-bypass)
    if (pathname.startsWith('/api/ws/')) {
      // Validate Origin header to prevent Cross-Site WebSocket Hijacking (CSWSH)
      const origin = request.headers.origin;
      if (origin) {
        const allowedHosts = [
          request.headers.host || '',
          process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).host : '',
        ].filter(Boolean);
        const originHost = new URL(origin).host;
        if (!allowedHosts.includes(originHost)) {
          console.warn(`[WS Upgrade] Rejected cross-origin WebSocket upgrade from: ${origin}`);
          socket.destroy();
          return;
        }
      }

      // Validate session cookie before performing the WebSocket upgrade
      const cookies = parseCookies(request.headers.cookie || '');
      const cookieName = cookies['authjs.session-token'] ? 'authjs.session-token' : '__Secure-authjs.session-token';
      const sessionToken = cookies[cookieName];
      console.log(`[WS Upgrade Auth] path=${pathname} cookieName=${cookieName} tokenFound=${!!sessionToken}`);

      if (!sessionToken) {
        console.warn(`[WS Upgrade] Rejected unauthenticated WebSocket upgrade to: ${pathname}`);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
    }

    if (pathname === '/api/ws/terminal') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else if (pathname === '/api/ws/vnc') {
      wssVnc.handleUpgrade(request, socket, head, (ws) => {
        wssVnc.emit('connection', ws, request);
      });
    } else if (pathname === '/api/ws/rdp') {
      wssRdp.handleUpgrade(request, socket, head, (ws) => {
        wssRdp.emit('connection', ws, request);
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
