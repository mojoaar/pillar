/**
 * Shared session registry for active WebSocket connections.
 * Imported by server.ts (writes) and admin API routes (reads).
 */

interface ActiveSession {
  ws: unknown;
  username: string;
  host: string;
  startedAt: Date;
  connectionId: string;
  protocol: string;
}

interface SessionData {
  sessionId: string;
  username: string;
  host: string;
  startedAt: Date;
  connectionId: string;
  protocol: string;
}

// Cache the registry map on globalThis to ensure server.ts and Next.js API compile isolates
// share the exact same active sessions map registry in development mode (Finding #session-sync)
const globalForSessions = globalThis as unknown as {
  sessionRegistryMap: Map<string, ActiveSession> | undefined;
};

const _registry = globalForSessions.sessionRegistryMap ?? new Map<string, ActiveSession>();

// Always store the session registry on globalThis so server.ts (tsc-compiled) and Next.js API
// routes (Turbopack-compiled) share the exact same map instance in both dev and production.
globalForSessions.sessionRegistryMap = _registry;

export const sessionRegistry = {
  set(sessionId: string, session: ActiveSession) {
    _registry.set(sessionId, session);
  },

  delete(sessionId: string) {
    _registry.delete(sessionId);
  },

  count(): number {
    return _registry.size;
  },

  getAll(): SessionData[] {
    return Array.from(_registry.entries()).map(([id, s]) => ({
      sessionId: id,
      username: s.username,
      host: s.host,
      startedAt: s.startedAt,
      connectionId: s.connectionId,
      protocol: s.protocol,
    }));
  },

  terminate(sessionId: string): boolean {
    const session = _registry.get(sessionId);
    if (session) {
      // Close the underlying WebSocket
      try { (session.ws as any).close(1000, 'Force closed by administrator'); } catch (e) {}
      _registry.delete(sessionId);
      return true;
    }
    return false;
  },
};
