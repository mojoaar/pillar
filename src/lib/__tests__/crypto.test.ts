import { describe, it, expect, beforeEach } from 'vitest';

// Save and restore original env
const originalEnv = { ...process.env };

describe('crypto', () => {
  beforeEach(() => {
    // Reset env before each test to ensure clean state
    process.env = { ...originalEnv };
    // Set a valid 64-char hex key for tests
    process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    // Clear module cache to re-read env
    vi.resetModules();
  });

  it('encrypt(null) throws', async () => {
    const { encrypt } = await import('../crypto');
    expect(() => encrypt(null as any)).toThrow('requires a non-null string input');
  });

  it('decrypt(null) throws', async () => {
    const { decrypt } = await import('../crypto');
    expect(() => decrypt(null as any)).toThrow('requires a non-null string input');
  });

  it('encrypt("") returns empty string', async () => {
    const { encrypt } = await import('../crypto');
    expect(encrypt('')).toBe('');
  });

  it('decrypt("") returns empty string', async () => {
    const { decrypt } = await import('../crypto');
    expect(decrypt('')).toBe('');
  });

  it('encrypt produces iv:tag:ciphertext format', async () => {
    const { encrypt } = await import('../crypto');
    const result = encrypt('hello world');
    const parts = result.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24); // 12 bytes hex = 24 chars
    expect(parts[1]).toHaveLength(32); // 16 bytes hex = 32 chars
  });

  it('round-trip encrypt/decrypt preserves original text', async () => {
    const { encrypt, decrypt } = await import('../crypto');
    const original = 'my secret password 123!';
    expect(decrypt(encrypt(original))).toBe(original);
  });

  it('round-trip with special characters', async () => {
    const { encrypt, decrypt } = await import('../crypto');
    const original = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`\n\t';
    expect(decrypt(encrypt(original))).toBe(original);
  });

  it('maskSecret hides content', async () => {
    const { maskSecret } = await import('../crypto');
    expect(maskSecret('my-secret-token')).toBe('••••••••');
  });

  it('maskSecret handles null/undefined', async () => {
    const { maskSecret } = await import('../crypto');
    expect(maskSecret(null)).toBe('');
    expect(maskSecret(undefined)).toBe('');
  });

  it('throws when ENCRYPTION_KEY is missing', async () => {
    delete process.env.ENCRYPTION_KEY;
    const { encrypt } = await import('../crypto');
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
  });

  it('throws when ENCRYPTION_KEY is not 64 hex chars', async () => {
    process.env.ENCRYPTION_KEY = 'short-key';
    const { encrypt } = await import('../crypto');
    expect(() => encrypt('test')).toThrow('64-character hex string');
  });
});
