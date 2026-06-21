import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('plugins service', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('hasPluginAccess returns true for ADMIN regardless of allowedPlugins', async () => {
    vi.doMock('../db', () => ({
      db: { user: { findUnique: async () => ({ allowedPlugins: null }) } },
    }));
    const { hasPluginAccess } = await import('../plugins/service');
    expect(await hasPluginAccess('u1', 'ADMIN', 'proxmox-ve')).toBe(true);
    expect(await hasPluginAccess('u1', 'ADMIN', 'any-plugin')).toBe(true);
  });

  it('hasPluginAccess returns true for USER with matching plugin', async () => {
    vi.doMock('../db', () => ({
      db: { user: { findUnique: async () => ({ allowedPlugins: 'proxmox-ve,other-plugin' }) } },
    }));
    const { hasPluginAccess } = await import('../plugins/service');
    expect(await hasPluginAccess('u1', 'USER', 'proxmox-ve')).toBe(true);
    expect(await hasPluginAccess('u1', 'USER', 'other-plugin')).toBe(true);
  });

  it('hasPluginAccess returns false for USER without plugin', async () => {
    vi.doMock('../db', () => ({
      db: { user: { findUnique: async () => ({ allowedPlugins: 'some-plugin' }) } },
    }));
    const { hasPluginAccess } = await import('../plugins/service');
    expect(await hasPluginAccess('u1', 'USER', 'proxmox-ve')).toBe(false);
  });

  it('hasPluginAccess returns false when user not found', async () => {
    vi.doMock('../db', () => ({
      db: { user: { findUnique: async () => null } },
    }));
    const { hasPluginAccess } = await import('../plugins/service');
    expect(await hasPluginAccess('u1', 'USER', 'proxmox-ve')).toBe(false);
  });

  it('getPluginConfig returns null when plugin is disabled', async () => {
    vi.doMock('../db', () => ({
      db: { plugin: { findUnique: async () => ({ id: 'pve', enabled: false, config: null }) } },
    }));
    const { getPluginConfig } = await import('../plugins/service');
    expect(await getPluginConfig('pve')).toBeNull();
  });

  it('getPluginConfig returns config when enabled', async () => {
    process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const { encrypt } = await import('../crypto');
    const configStr = encrypt(JSON.stringify({ apiUrl: 'https://pve.local', apiToken: 'secret' }));
    vi.doMock('../db', () => ({
      db: { plugin: { findUnique: async () => ({ id: 'pve', enabled: true, config: configStr }) } },
    }));
    const { getPluginConfig } = await import('../plugins/service');
    const cfg = await getPluginConfig('pve');
    expect(cfg).not.toBeNull();
    expect(cfg.apiUrl).toBe('https://pve.local');
    expect(cfg.apiToken).toBe('secret');
  });

  it('savePluginConfig encrypts and upserts', async () => {
    process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const upsertFn = vi.fn();
    vi.doMock('../db', () => ({
      db: { plugin: { upsert: upsertFn } },
    }));
    const { savePluginConfig } = await import('../plugins/service');
    await savePluginConfig('pve', true, { apiUrl: 'https://pve.local', apiToken: 'sekret' });
    expect(upsertFn).toHaveBeenCalledTimes(1);
    const call = upsertFn.mock.calls[0][0];
    expect(call.create.enabled).toBe(true);
    expect(call.create.id).toBe('pve');
    expect(call.create.config).toBeTruthy();
    expect(call.create.config).not.toContain('sekret'); // encrypted
  });
});
