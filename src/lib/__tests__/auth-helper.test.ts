import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('auth-helper', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
  });

  it('returns session user when session is valid', async () => {
    const mockUser = { id: 'u1', email: 'a@b.com', name: 'Test', role: 'ADMIN', username: 'test' };
    vi.doMock('../auth', () => ({ auth: async () => ({ user: mockUser }) }));
    const { authenticateRequest } = await import('../auth-helper');
    const result = await authenticateRequest(new Request('http://localhost/test'));
    expect(result).not.toBeNull();
    expect(result!.authType).toBe('SESSION');
  });

  it('returns null when no session and no auth header', async () => {
    vi.doMock('../auth', () => ({ auth: async () => null }));
    const { authenticateRequest } = await import('../auth-helper');
    expect(await authenticateRequest(new Request('http://localhost/test'))).toBeNull();
  });

  it('returns user for valid bearer token', async () => {
    const c = await import('crypto');
    const token = 'pil_live_test1234567890abc';
    const hashed = c.createHmac('sha256', process.env.ENCRYPTION_KEY!).update(token).digest('hex');
    vi.doMock('../auth', () => ({ auth: async () => null }));
    vi.doMock('../db', () => ({
      db: { apiKey: { findFirst: async (q: any) => q.where.keyHash === hashed ? { userId: 'u1', expiresAt: null, user: { id: 'u1', email: 'a@b.com', name: 'T', role: 'USER', username: 't', isSuspended: false } } : null } },
    }));
    const { authenticateRequest } = await import('../auth-helper');
    const result = await authenticateRequest(new Request('http://localhost/test', { headers: { Authorization: `Bearer ${token}` } }));
    expect(result).not.toBeNull();
    expect(result!.authType).toBe('API_KEY');
  });

  it('returns null for invalid bearer token', async () => {
    vi.doMock('../auth', () => ({ auth: async () => null }));
    vi.doMock('../db', () => ({ db: { apiKey: { findFirst: async () => null } } }));
    const { authenticateRequest } = await import('../auth-helper');
    expect(await authenticateRequest(new Request('http://localhost/test', { headers: { Authorization: 'Bearer bad' } }))).toBeNull();
  });

  it('returns null for expired API key', async () => {
    vi.doMock('../auth', () => ({ auth: async () => null }));
    vi.doMock('../db', () => ({ db: { apiKey: { findFirst: async () => ({ userId: 'u1', expiresAt: new Date('2020-01-01'), user: { id: 'u1', email: 'a@b.com', name: 'T', role: 'USER', username: 't', isSuspended: false } }) } } }));
    const { authenticateRequest } = await import('../auth-helper');
    expect(await authenticateRequest(new Request('http://localhost/test', { headers: { Authorization: 'Bearer pil_live_xxx' } }))).toBeNull();
  });

  it('returns null for suspended user API key', async () => {
    vi.doMock('../auth', () => ({ auth: async () => null }));
    vi.doMock('../db', () => ({ db: { apiKey: { findFirst: async () => ({ userId: 'u1', expiresAt: null, user: { id: 'u1', email: 'a@b.com', name: 'T', role: 'USER', username: 't', isSuspended: true } }) } } }));
    const { authenticateRequest } = await import('../auth-helper');
    expect(await authenticateRequest(new Request('http://localhost/test', { headers: { Authorization: 'Bearer pil_live_y' } }))).toBeNull();
  });
});
