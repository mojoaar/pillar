'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupForm() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('admin');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic client validations
    if (!email || !username || !name || !password) {
      setError('All fields are required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, name, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Setup failed');
      }

      // First admin created successfully. Redirect to login.
      // Gotcha #10: Use direct location.href for auth transitions to guarantee cookie updates
      window.location.href = '/login?setup=success';
    } catch (err: any) {
      setError(err.message || 'An error occurred during setup');
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
      <div className="card" style={{ maxWidth: '480px', width: '100%' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--accent)', textAlign: 'center' }}>
          Initialize Pillar Gateway
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          Create the first administrator account to secure your remote workspace.
        </p>

        {error && (
          <div style={{
            backgroundColor: 'rgba(255, 85, 85, 0.1)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
            padding: '0.75rem',
            borderRadius: 'var(--border-radius)',
            fontSize: '0.875rem',
            marginBottom: '1rem',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Display Name</label>
            <input
              type="text"
              id="name"
              className="input-field"
              placeholder="e.g. Alex M."
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Admin Email</label>
            <input
              type="email"
              id="email"
              className="input-field"
              placeholder="admin@homelab.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              className="input-field"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password (min 8 chars)</label>
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

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              className="input-field"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Configuring System...' : 'Create Admin Account →'}
          </button>
        </form>
      </div>
    </div>
  );
}
