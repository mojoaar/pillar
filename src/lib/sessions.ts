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

const _registry = new Map<string, ActiveSession>();

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
