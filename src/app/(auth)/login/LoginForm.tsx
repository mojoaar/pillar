'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  
  const [showMfa, setShowMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check for success message from setup redirection
    if (searchParams.get('setup') === 'success') {
      setSuccess('Pillar initialized successfully! Sign in with your administrator credentials.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    if (showMfa && !totpCode) {
      setError('Please input your 6-digit MFA security code.');
      return;
    }

    setLoading(true);

    try {
      const rawCallback = searchParams.get('callbackUrl') || '/dashboard';
      const callbackUrl = rawCallback.startsWith('/') ? rawCallback : '/dashboard';
      
      const res = await signIn('credentials', {
        email,
        password,
        totpCode: showMfa ? totpCode : undefined,
        redirect: false,
      });

      if (res?.error) {
        if (res.error.includes('MFA_REQUIRED')) {
          setShowMfa(true);
          setLoading(false);
          setError(null);
          return;
        }
        
        // Map common NextAuth errors to user-friendly messages
        if (res.error === 'CredentialsSignin') {
          setError('Invalid email or password.');
        } else {
          setError(res.error);
        }
        setLoading(false);
      } else {
        // Gotcha #10: Always perform a direct hard location.href update for logins
        // to force browsers to load and transmit updated authorization headers in next fetch sequences
        window.location.href = callbackUrl;
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred during authentication.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      padding: '1.5rem'
    }}>
      <div className="card" style={{ maxWidth: '420px', width: '100%' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--accent)', textAlign: 'center', letterSpacing: '0.05em' }}>
          PILLAR
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          Homelab Remote Access Gateway
        </p>

        {success && (
          <div style={{
            backgroundColor: 'rgba(80, 250, 123, 0.1)',
            border: '1px solid var(--success)',
            color: 'var(--success)',
            padding: '0.75rem',
            borderRadius: 'var(--border-radius)',
            fontSize: '0.85rem',
            marginBottom: '1rem',
            lineHeight: '1.4'
          }}>
            {success}
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: 'rgba(255, 85, 85, 0.1)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
            padding: '0.75rem',
            borderRadius: 'var(--border-radius)',
            fontSize: '0.85rem',
            marginBottom: '1rem',
            lineHeight: '1.4'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!showMfa ? (
            <>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  className="input-field"
                  placeholder="admin@pillar.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </>
          ) : (
            <div className="form-group" style={{ textAlign: 'center' }}>
              <label htmlFor="totpCode" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
                🔑 Enter MFA Code
              </label>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                Open your authenticator app and enter the rotating 6-digit code, or use a single-use backup recovery code.
              </p>
              <input
                type="text"
                id="totpCode"
                className="input-field"
                placeholder="123456 or XXXX-XXXX"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.toUpperCase().substring(0, 9))}
                disabled={loading}
                maxLength={9}
                autoFocus
                required
                style={{
                  textAlign: 'center',
                  fontSize: '1.25rem',
                  letterSpacing: '0.15em',
                  padding: '0.75rem',
                  fontFamily: 'var(--terminal-font)',
                }}
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : showMfa ? 'Verify and Sign In →' : 'Sign In'}
          </button>

          {showMfa && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.85rem' }}
              onClick={() => {
                setShowMfa(false);
                setTotpCode('');
                setError(null);
              }}
              disabled={loading}
            >
              ← Back to credentials
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
