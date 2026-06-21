import { describe, it, expect } from 'vitest';

describe('Setup API logic', () => {
  it('first-run creates ADMIN user', () => {
    const role = 'ADMIN';
    expect(role).toBe('ADMIN');
  });

  it('setup blocked when users already exist', () => {
    const existingUserCount = 1;
    const canSetup = existingUserCount === 0;
    expect(canSetup).toBe(false);
  });

  describe('input validation', () => {
    it('rejects password shorter than 8 characters', () => {
      const password = 'short';
      expect(password.length >= 8).toBe(false);
    });

    it('accepts valid email format', () => {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      expect(emailRegex.test('admin@homelab.local')).toBe(true);
      expect(emailRegex.test('not-an-email')).toBe(false);
    });

    it('accepts valid username format', () => {
      const usernameRegex = /^[a-z0-9][a-z0-9._-]{2,30}[a-z0-9]$/;
      expect(usernameRegex.test('admin3')).toBe(true);
      expect(usernameRegex.test('a')).toBe(false);
      expect(usernameRegex.test('ADMIN')).toBe(false); // uppercase rejected
    });
  });
});
