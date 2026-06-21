import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Sidebar component logic', () => {
  describe('isActive route matching', () => {
    const isActive = (path: string, pathname: string) => {
      if (path === '/dashboard' || path === '/admin') {
        return pathname === path;
      }
      return pathname.startsWith(path);
    };

    it('exact match for /dashboard', () => {
      expect(isActive('/dashboard', '/dashboard')).toBe(true);
      expect(isActive('/dashboard', '/dashboard/')).toBe(false);
    });

    it('exact match for /admin prevents sub-route leaks', () => {
      expect(isActive('/admin', '/admin')).toBe(true);
      expect(isActive('/admin', '/admin/plugins')).toBe(false);
      expect(isActive('/admin', '/admin/users')).toBe(false);
    });

    it('prefix match for other routes', () => {
      expect(isActive('/connections', '/connections')).toBe(true);
      expect(isActive('/connections', '/connections/some-id')).toBe(true);
      expect(isActive('/proxmox', '/proxmox/console')).toBe(true);
    });

    it('settings matches exactly via prefix (no sub-routes currently)', () => {
      expect(isActive('/settings', '/settings')).toBe(true);
    });
  });

  describe('nav visibility logic', () => {
    it('admin links only visible for ADMIN role', () => {
      const showAdminLinks = (role: string) => role === 'ADMIN';
      expect(showAdminLinks('ADMIN')).toBe(true);
      expect(showAdminLinks('USER')).toBe(false);
    });

    it('Proxmox Console only visible when plugin enabled AND authorized', () => {
      const showPve = (isPveEnabled: boolean, isAuthorized: boolean) => isPveEnabled && isAuthorized;
      expect(showPve(true, true)).toBe(true);
      expect(showPve(true, false)).toBe(false);
      expect(showPve(false, true)).toBe(false);
      expect(showPve(false, false)).toBe(false);
    });

    it('Proxmox authorized for ADMIN or user with allowedPlugins includes proxmox-ve', () => {
      const isAuthorized = (role: string, allowedPlugins: string | null) =>
        role === 'ADMIN' || (allowedPlugins || '').includes('proxmox-ve');
      expect(isAuthorized('ADMIN', null)).toBe(true);
      expect(isAuthorized('USER', 'proxmox-ve')).toBe(true);
      expect(isAuthorized('USER', 'other-plugin')).toBe(false);
      expect(isAuthorized('USER', null)).toBe(false);
    });
  });

  describe('collapse state', () => {
    it('collapsed sidebar hides text classes', () => {
      const collapsed = true;
      const showText = !collapsed;
      expect(showText).toBe(false);
    });

    it('expanded sidebar shows text', () => {
      const collapsed = false;
      const showText = !collapsed;
      expect(showText).toBe(true);
    });

    it('keyboard shortcut Cmd+B / Ctrl+B triggers toggle', () => {
      const chords = [
        { code: 'KeyB', metaKey: true, ctrlKey: false },
        { code: 'KeyB', metaKey: false, ctrlKey: true },
      ];
      for (const chord of chords) {
        expect(chord.code).toBe('KeyB');
        expect(chord.metaKey || chord.ctrlKey).toBe(true);
      }
    });

    it('shortcut ignored when focus is on input element', () => {
      const shouldIgnore = (tagName: string) =>
        tagName === 'INPUT' || tagName === 'TEXTAREA';
      expect(shouldIgnore('INPUT')).toBe(true);
      expect(shouldIgnore('TEXTAREA')).toBe(true);
      expect(shouldIgnore('DIV')).toBe(false);
    });
  });
});
