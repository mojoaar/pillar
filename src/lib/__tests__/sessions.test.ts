import { describe, it, expect, beforeEach } from 'vitest';

describe('sessionRegistry', () => {
  // Reset module and global registry map before each test to get a fresh registry
  beforeEach(async () => {
    vi.resetModules();
    delete (globalThis as any).sessionRegistryMap;
  });

  it('count returns 0 for empty registry', async () => {
    const { sessionRegistry } = await import('../sessions');
    expect(sessionRegistry.count()).toBe(0);
  });

  it('getAll returns empty array initially', async () => {
    const { sessionRegistry } = await import('../sessions');
    expect(sessionRegistry.getAll()).toEqual([]);
  });

  it('set and getAll work correctly', async () => {
    const { sessionRegistry } = await import('../sessions');
    sessionRegistry.set('sess-1', {
      ws: {},
      userId: 'user-1',
      username: 'admin',
      host: '192.168.1.1',
      startedAt: new Date('2025-01-01'),
      connectionId: 'conn-1',
      protocol: 'SSH',
    });

    expect(sessionRegistry.count()).toBe(1);
    const all = sessionRegistry.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].sessionId).toBe('sess-1');
    expect(all[0].username).toBe('admin');
    expect(all[0].protocol).toBe('SSH');
    expect(all[0].connectionId).toBe('conn-1');
  });

  it('delete removes session and reduces count', async () => {
    const { sessionRegistry } = await import('../sessions');
    sessionRegistry.set('sess-1', {
      ws: {},
      userId: 'user-1',
      username: 'admin',
      host: '192.168.1.1',
      startedAt: new Date(),
      connectionId: 'c1',
      protocol: 'SSH',
    });
    expect(sessionRegistry.count()).toBe(1);
    sessionRegistry.delete('sess-1');
    expect(sessionRegistry.count()).toBe(0);
    expect(sessionRegistry.getAll()).toEqual([]);
  });

  it('multiple sessions tracked independently', async () => {
    const { sessionRegistry } = await import('../sessions');
    sessionRegistry.set('a', { userId: 'user-1', ws: {}, username: 'u1', host: 'h1', startedAt: new Date(), connectionId: 'c1', protocol: 'SSH' });
    sessionRegistry.set('b', { userId: 'user-2', ws: {}, username: 'u2', host: 'h2', startedAt: new Date(), connectionId: 'c2', protocol: 'VNC' });
    expect(sessionRegistry.count()).toBe(2);
    sessionRegistry.delete('a');
    expect(sessionRegistry.count()).toBe(1);
    expect(sessionRegistry.getAll()[0].sessionId).toBe('b');
  });

  it('terminate returns true for existing session and removes it', async () => {
    const { sessionRegistry } = await import('../sessions');
    const mockWs = { close: vi.fn() as any };
    sessionRegistry.set('sess-1', {
      ws: mockWs,
      userId: 'user-1',
      username: 'admin',
      host: 'h1',
      startedAt: new Date(),
      connectionId: 'c1',
      protocol: 'SSH',
    });
    expect(sessionRegistry.terminate('sess-1')).toBe(true);
    expect(sessionRegistry.count()).toBe(0);
    expect(mockWs.close).toHaveBeenCalledWith(1000, 'Force closed by administrator');
  });

  it('terminate returns false for non-existent session', async () => {
    const { sessionRegistry } = await import('../sessions');
    expect(sessionRegistry.terminate('nonexistent')).toBe(false);
  });
});
