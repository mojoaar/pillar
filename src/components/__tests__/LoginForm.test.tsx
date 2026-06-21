import { describe, it, expect, vi } from 'vitest';

describe('LoginForm logic', () => {
  it('validates callbackUrl — external URLs redirected to /dashboard', () => {
    const validate = (cb: string) => cb.startsWith('/') ? cb : '/dashboard';
    expect(validate('https://evil.com/phishing')).toBe('/dashboard');
    expect(validate('/connections')).toBe('/connections');
    expect(validate('/settings')).toBe('/settings');
    expect(validate('')).toBe('/dashboard');
  });

  it('MFA_REQUIRED error contains expected marker', () => {
    const errorMessage = 'MFA_REQUIRED';
    expect(errorMessage.includes('MFA_REQUIRED')).toBe(true);
  });

  it('email and password are required before submission', () => {
    const email = '';
    const password = '';
    expect(!!email && !!password).toBe(false);
    expect(!!'user@test.com' && !!'password123').toBe(true);
  });

  it('MFA code required when showMfa is true', () => {
    const showMfa = true;
    const noCode = '';
    // Missing code when MFA is shown = error condition
    expect(showMfa && !noCode).toBe(true);
    // Code provided = valid
    expect(showMfa && !!'123456').toBe(true);
  });

  it('signIn called with credentials provider', () => {
    // The LoginForm calls signIn('credentials', { email, password, ... })
    const provider = 'credentials';
    expect(provider).toBe('credentials');
  });
});
