import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import next from 'next';
import { parse } from 'url';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js app instance
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressApp = express();
  const server = http.createServer(expressApp);

  // Initialize WebSocket Server attached to the shared HTTP server
  const wss = new WebSocketServer({ noServer: true });

  // Simple session registry to track active connections globally
  const activeSessions = new Map<string, { ws: WebSocket; username: string; startedAt: Date }>();

  // Expose session count for administration / dashboard checks
  (globalThis as any).activeSSHCount = () => activeSessions.size;

  // Handle WebSocket connections
  wss.on('connection', (ws: WebSocket, request) => {
    const url = request.url || '';
    const query = parse(url, true).query;
    const sessionId = (query.sessionId as string) || Math.random().toString(36).substring(2, 9);
    
    console.log(`[WS] Client connected. Session: ${sessionId}`);
    
    activeSessions.set(sessionId, {
      ws,
      username: 'anonymous', // will be authenticated in Phase 4
      startedAt: new Date(),
    });

    ws.on('message', (message) => {
      // Basic echo handler for validation during early phases
      try {
        const data = message.toString();
        // Parse message if it is JSON
        if (data.startsWith('{')) {
          const parsed = JSON.parse(data);
          if (parsed.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } else {
          // Echo raw keystrokes
          ws.send(`Echo: ${data}`);
        }
      } catch (err) {
        console.error('[WS] Error processing message:', err);
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Client disconnected. Session: ${sessionId}`);
      activeSessions.delete(sessionId);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error on session ${sessionId}:`, err);
    });
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

  // Pass all standard requests (HTML pages, APIs, statics) directly to Next.js handler
  expressApp.all('*', (req, res) => {
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
