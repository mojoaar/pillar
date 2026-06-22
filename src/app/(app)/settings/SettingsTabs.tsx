'use client';

import React, { useState, useEffect } from 'react';
import { useTheme, ThemeName, FontName } from '@/components/theme/ThemeProvider';
import { getDefaultTimezone, DateFormatPreference } from '@/lib/datetime';
import { User, Shield, Sliders, Upload, Check, AlertTriangle, ShieldCheck, Key, Trash2, Copy, Plus } from 'lucide-react';

interface UserData {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  mfaEnabled: boolean;
}

interface SettingsTabsProps {
  user: UserData;
}

export default function SettingsTabs({ user: initialUser }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences' | 'apikeys'>('profile');
  const [user, setUser] = useState<UserData>(initialUser);

  // Form States - Profile
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatarUrl);

  // Form States - Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Form States - MFA setup
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaSecret, setMfaQrSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[]>([]);
  const [isEnrollingMfa, setIsEnrollingMfa] = useState(false);

  // Preferences (stored in localStorage)
  const { theme, font, setTheme, setFont } = useTheme();
  const [hour12, setHour12] = useState(false);
  const [dateFormat, setDateFormat] = useState<DateFormatPreference>('EU');
  const [timezone, setTimezone] = useState(getDefaultTimezone());
  const [timezones, setTimezones] = useState<string[]>(['UTC']);
  const [scrollback, setScrollback] = useState(1000); // Terminal scrollback history lines (Finding #scrollback)
  const [terminalFontSize, setTerminalFontSize] = useState(14);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedClock = localStorage.getItem('pillar-clock');
    const savedDate = localStorage.getItem('pillar-date') as DateFormatPreference;
    const savedTz = localStorage.getItem('pillar-timezone');
    const savedScrollback = localStorage.getItem('pillar-scrollback');
    const savedFontSize = localStorage.getItem('pillar-terminal-font-size');

    if (savedClock) setHour12(savedClock === '12h');
    if (savedDate) setDateFormat(savedDate);
    if (savedTz) setTimezone(savedTz);
    if (savedScrollback) setScrollback(Number(savedScrollback));
    if (savedFontSize) {
      setTerminalFontSize(Number(savedFontSize));
      document.documentElement.style.setProperty('--font-size-terminal', `${savedFontSize}px`);
    }

    // Load all supported standard IANA timezones dynamically
    try {
      if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
        setTimezones(Intl.supportedValuesOf('timeZone'));
      } else {
        setTimezones([
          'UTC', 'Europe/Oslo', 'Europe/London', 'Europe/Paris', 
          'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
          'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney'
        ]);
      }
    } catch {
      setTimezones(['UTC']);
    }
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // 1. Upload avatar if selected
      let updatedAvatarUrl = user.avatarUrl;
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);

        const uploadRes = await fetch('/api/profile/avatar', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || 'Failed to upload avatar image.');
        }
        updatedAvatarUrl = uploadData.data.avatarUrl;
      }

      // 2. Update profile text parameters
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile settings.');
      }

      setUser({
        ...user,
        name: data.data.name,
        username: data.data.username,
        email: data.data.email,
        avatarUrl: updatedAvatarUrl,
      });

      setSuccess('Profile settings updated successfully!');
      setAvatarFile(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword) {
      setError('Both current password and new password are required.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password.');
      }

      setSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleInitMfa = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/profile/mfa/generate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize MFA.');
      }

      setMfaQrCode(data.data.qrCode);
      setMfaQrSecret(data.data.secret);
      setMfaBackupCodes(data.data.backupCodes || []);
      setIsEnrollingMfa(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred generating secret.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!mfaCode) {
      setError('Verification code is required.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/profile/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'MFA token verification failed.');
      }

      setUser({ ...user, mfaEnabled: true });
      setSuccess('MFA TOTP enrolled successfully!');
      setIsEnrollingMfa(false);
      setMfaQrCode(null);
      setMfaQrSecret(null);
      setMfaCode('');
    } catch (err: any) {
      setError(err.message || 'An error occurred during verification.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);

    // Save configurations inside localStorage
    localStorage.setItem('pillar-clock', hour12 ? '12h' : '24h');
    localStorage.setItem('pillar-date', dateFormat);
    localStorage.setItem('pillar-timezone', timezone);
    localStorage.setItem('pillar-scrollback', scrollback.toString());
    localStorage.setItem('pillar-terminal-font-size', terminalFontSize.toString());
    document.documentElement.style.setProperty('--font-size-terminal', `${terminalFontSize}px`);

    setSuccess('Preferences saved successfully!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Title */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
          Account & Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Manage your personal profile, credentials, and visual environment options.
        </p>
      </div>

      {/* Settings Navigation Tabs Bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        gap: '0.25rem'
      }}>
        <button
          onClick={() => { setActiveTab('profile'); setError(null); setSuccess(null); }}
          className="btn"
          style={{
            backgroundColor: activeTab === 'profile' ? 'var(--bg-tertiary)' : 'transparent',
            borderBottom: activeTab === 'profile' ? '2px solid var(--accent)' : 'none',
            borderRadius: 'var(--border-radius) var(--border-radius) 0 0',
            color: activeTab === 'profile' ? 'var(--accent)' : 'var(--text-primary)',
            padding: '0.75rem 1.25rem'
          }}
        >
          <User size={18} />
          <span>Profile</span>
        </button>

        <button
          onClick={() => { setActiveTab('security'); setError(null); setSuccess(null); }}
          className="btn"
          style={{
            backgroundColor: activeTab === 'security' ? 'var(--bg-tertiary)' : 'transparent',
            borderBottom: activeTab === 'security' ? '2px solid var(--accent)' : 'none',
            borderRadius: 'var(--border-radius) var(--border-radius) 0 0',
            color: activeTab === 'security' ? 'var(--accent)' : 'var(--text-primary)',
            padding: '0.75rem 1.25rem'
          }}
        >
          <Shield size={18} />
          <span>Security & MFA</span>
        </button>

        <button
          onClick={() => { setActiveTab('preferences'); setError(null); setSuccess(null); }}
          className="btn"
          style={{
            backgroundColor: activeTab === 'preferences' ? 'var(--bg-tertiary)' : 'transparent',
            borderBottom: activeTab === 'preferences' ? '2px solid var(--accent)' : 'none',
            borderRadius: 'var(--border-radius) var(--border-radius) 0 0',
            color: activeTab === 'preferences' ? 'var(--accent)' : 'var(--text-primary)',
            padding: '0.75rem 1.25rem'
          }}
        >
          <Sliders size={18} />
          <span>Preferences</span>
        </button>

        <button
          onClick={() => { setActiveTab('apikeys'); setError(null); setSuccess(null); }}
          className="btn"
          style={{
            backgroundColor: activeTab === 'apikeys' ? 'var(--bg-tertiary)' : 'transparent',
            borderBottom: activeTab === 'apikeys' ? '2px solid var(--accent)' : 'none',
            borderRadius: 'var(--border-radius) var(--border-radius) 0 0',
            color: activeTab === 'apikeys' ? 'var(--accent)' : 'var(--text-primary)',
            padding: '0.75rem 1.25rem'
          }}
        >
          <Key size={18} />
          <span>API Keys</span>
        </button>
      </div>

      {/* Global Alerts inside tabs */}
      {success && (
        <div style={{
          backgroundColor: 'rgba(80, 250, 123, 0.1)',
          border: '1px solid var(--success)',
          color: 'var(--success)',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--border-radius)',
          fontSize: '0.875rem'
        }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: 'rgba(255, 85, 85, 0.1)',
          border: '1px solid var(--danger)',
          color: 'var(--danger)',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--border-radius)',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      {/* ==========================================
         TAB CONTENT SECTIONS
         ========================================== */}

      {/* 1. PROFILE TAB */}
      {activeTab === 'profile' && (
        <div className="card" style={{ maxWidth: '560px' }}>
          <form onSubmit={handleProfileSubmit}>
            {/* Avatar Upload Grid */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent)',
                color: 'var(--bg-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                fontWeight: 700,
                overflow: 'hidden',
                border: '3px solid var(--border)'
              }}>
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="avatar-file" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
                  <Upload size={14} />
                  <span>Choose Image</span>
                </label>
                <input
                  type="file"
                  id="avatar-file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleAvatarChange}
                  disabled={loading}
                  style={{ display: 'none' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Accepted formats: PNG, JPEG, WEBP. Max size: 2MB.
                </span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="display-name">Display Name</label>
              <input
                type="text"
                id="display-name"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Saving Settings...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      )}

      {/* 2. SECURITY TAB */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '560px' }}>
          {/* Credentials Adjustment */}
          <div className="card">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              Change Account Password
            </h3>
            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group">
                <label htmlFor="current-pw">Current Password</label>
                <input
                  type="password"
                  id="current-pw"
                  className="input-field"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="new-pw">New Password (min 8 chars)</label>
                <input
                  type="password"
                  id="new-pw"
                  className="input-field"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirm-pw">Confirm New Password</label>
                <input
                  type="password"
                  id="confirm-pw"
                  className="input-field"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={loading}>
                {loading ? 'Changing Password...' : 'Change Password'}
              </button>
            </form>
          </div>

          {/* Multi-Factor Authentication */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              Two-Factor Authentication (MFA)
            </h3>

            {user.mfaEnabled ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--success)' }}>
                <ShieldCheck size={28} />
                <div>
                  <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>TOTP MFA is Enabled</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                    Your account is securely protected by standard 6-digit authentication challenges.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--warning)' }}>
                  <AlertTriangle size={28} />
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Two-Factor is Disabled</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                      Enforce MFA to prevent unauthorized sign-ins on your Pillar Remote Gateway.
                    </p>
                  </div>
                </div>

                {!isEnrollingMfa ? (
                  <button className="btn btn-secondary" onClick={handleInitMfa} disabled={loading} style={{ alignSelf: 'flex-start' }}>
                    Configure Multi-Factor Authentication
                  </button>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1.25rem',
                    border: '1px solid var(--border)',
                    padding: '1.5rem',
                    borderRadius: 'var(--border-radius)',
                    backgroundColor: 'var(--bg-tertiary)',
                    marginTop: '0.5rem'
                  }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Enroll Authenticator App</h4>
                    
                    {/* QR Code Container */}
                    {mfaQrCode && (
                      <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#fff',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border)'
                      }}>
                        <img src={mfaQrCode} alt="TOTP QR Code" style={{ width: '160px', height: '160px' }} />
                      </div>
                    )}

                    <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      <p>Scan this QR code using Google Authenticator, Authy, or Bitwarden.</p>
                      {mfaSecret && (
                        <p style={{ marginTop: '0.5rem' }}>
                          Manual key code: <code style={{ fontFamily: 'var(--terminal-font)', color: 'var(--accent)', fontSize: '0.85rem' }}>{mfaSecret}</code>
                        </p>
                      )}
                    </div>

                    {mfaBackupCodes.length > 0 && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--border-radius)',
                        width: '100%',
                        textAlign: 'left'
                      }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--warning)', display: 'block', marginBottom: '0.5rem', textAlign: 'center' }}>
                          ⚠️ SAVE THESE RECOVERY CODES!
                        </span>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: '1.4', textAlign: 'center' }}>
                          They allow logging in if you lose your MFA device. Each code can only be used once.
                        </p>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '0.5rem',
                          fontFamily: 'var(--terminal-font)',
                          fontSize: '0.8rem',
                          color: 'var(--success)',
                          textAlign: 'center',
                          fontWeight: 600
                        }}>
                          {mfaBackupCodes.map((code, idx) => (
                            <div key={idx} style={{ backgroundColor: 'var(--bg-tertiary)', padding: '0.25rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                              {code}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <form onSubmit={handleVerifyMfa} style={{ width: '100%', maxWidth: '280px', textAlign: 'center' }}>
                      <div className="form-group" style={{ textAlign: 'center' }}>
                        <label htmlFor="mfa-token-code" style={{ fontSize: '0.85rem' }}>Enter Verification Code</label>
                        <input
                          type="text"
                          id="mfa-token-code"
                          className="input-field"
                          placeholder="123456"
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                          disabled={loading}
                          maxLength={6}
                          required
                          style={{
                            textAlign: 'center',
                            fontSize: '1.25rem',
                            letterSpacing: '0.2em',
                            fontFamily: 'var(--terminal-font)',
                            padding: '0.5rem',
                            marginTop: '0.25rem'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setIsEnrollingMfa(false)}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={loading}>
                          {loading ? 'Verifying...' : 'Enable TOTP'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. PREFERENCES TAB */}
      {activeTab === 'preferences' && (
        <div className="card" style={{ maxWidth: '560px' }}>
          <form onSubmit={handlePreferencesSubmit}>
            <div className="form-group">
              <label htmlFor="pref-theme">Visual Theme Palette</label>
              <select
                id="pref-theme"
                className="input-field"
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeName)}
                style={{ cursor: 'pointer' }}
              >
                <option value="dracula-dark">Dracula (Dark)</option>
                <option value="dracula-light">Dracula (Light)</option>
                <option value="nord-dark">Nord (Dark)</option>
                <option value="nord-light">Nord (Light)</option>
                <option value="cyberpunk-dark">Cyberpunk (Dark)</option>
                <option value="cyberpunk-light">Cyberpunk (Light)</option>
                <option value="github-dark">GitHub (Dark)</option>
                <option value="github-light">GitHub (Light)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="pref-font">Terminal Monospace Font</label>
              <select
                id="pref-font"
                className="input-field"
                value={font}
                onChange={(e) => setFont(e.target.value as FontName)}
                style={{ cursor: 'pointer' }}
              >
                <option value="jetbrains-mono">JetBrains Mono</option>
                <option value="fira-code">Fira Code</option>
                <option value="source-code-pro">Source Code Pro</option>
                <option value="inconsolata">Inconsolata</option>
                <option value="roboto-mono">Roboto Mono</option>
                <option value="ubuntu-mono">Ubuntu Mono</option>
                <option value="ibm-plex-mono">IBM Plex Mono</option>
                <option value="anonymous-pro">Anonymous Pro</option>
                <option value="cascadia-code">Cascadia Mono</option>
                <option value="sf-mono">SF Mono (System)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Clock Time Format</label>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="radio"
                    name="clockFormat"
                    checked={!hour12}
                    onChange={() => setHour12(false)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>24-Hour (e.g. 15:30)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="radio"
                    name="clockFormat"
                    checked={hour12}
                    onChange={() => setHour12(true)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>12-Hour (AM/PM)</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="pref-date">Date Ordering Preference</label>
              <select
                id="pref-date"
                className="input-field"
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as DateFormatPreference)}
                style={{ cursor: 'pointer' }}
              >
                <option value="EU">EU Format (DD/MM/YYYY)</option>
                <option value="US">US Format (MM/DD/YYYY)</option>
                <option value="ISO">ISO Standard (YYYY-MM-DD)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="pref-tz">System IANA Timezone</label>
              <select
                id="pref-tz"
                className="input-field"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="pref-scrollback">Terminal Scrollback History Lines</label>
              <input
                type="number"
                id="pref-scrollback"
                className="input-field"
                min={100}
                max={50000}
                value={scrollback}
                onChange={(e) => setScrollback(Number(e.target.value))}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Number of lines kept in terminal viewport memory (Min 100, Max 50,000).
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="pref-terminal-font-size">Terminal Font Size</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="range"
                  id="pref-terminal-font-size"
                  min={12}
                  max={24}
                  step={1}
                  value={terminalFontSize}
                  onChange={(e) => setTerminalFontSize(Number(e.target.value))}
                  style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, minWidth: '2.5rem', textAlign: 'center', fontFamily: 'var(--terminal-font)' }}>
                  {terminalFontSize}px
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Default terminal monospace font size for SSH sessions (12–24px). Takes effect on new connections.
              </span>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Save Application Preferences
            </button>
          </form>
        </div>
      )}

      {/* 4. API KEYS TAB */}
      {activeTab === 'apikeys' && <ApiKeysPanel />}
    </div>
  );
}

function ApiKeysPanel() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [expiresDays, setExpiresDays] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profile/keys');
      const data = await res.json();
      if (res.ok) setKeys(data.data || []);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/profile/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: keyName.trim(), 
          expiresDays: expiresDays ? parseInt(expiresDays, 10) : 0 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create.');
      
      setGeneratedToken(data.data.token);
      setKeyName('');
      setExpiresDays('');
      setShowCreate(false);
      fetchKeys();
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key permanently? All services using it will lose access immediately.')) return;
    try {
      const res = await fetch(`/api/profile/keys?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchKeys();
        setSuccess('API key revoked.');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (e) {}
  };

  const copyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '640px' }}>
      <div className="flex-between" style={{ marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Personal API Tokens</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Generate bearer tokens for programmatic scripting access. Tokens validate using SHA-256 hash matching.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowCreate(true); setGeneratedToken(null); setCopied(false); }}>
          <Plus size={14} />
          <span>New Token</span>
        </button>
      </div>

      {success && (
        <div style={{ backgroundColor: 'rgba(80,250,123,0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '0.5rem', borderRadius: 'var(--border-radius)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{success}</div>
      )}
      {error && (
        <div style={{ backgroundColor: 'rgba(255,85,85,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '0.5rem', borderRadius: 'var(--border-radius)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{error}</div>
      )}

      {generatedToken && (
        <div style={{
          backgroundColor: 'rgba(189,147,249,0.1)',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--border-radius)',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Check size={16} style={{ color: 'var(--success)' }} />
            <strong style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>Token Generated Successfully</strong>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginBottom: '0.5rem' }}>
            Store this token securely. You will not be able to see it again!
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '0.5rem'
          }}>
            <code style={{ flex: 1, fontSize: '0.75rem', wordBreak: 'break-all', color: 'var(--text-primary)', fontFamily: 'var(--terminal-font)' }}>
              {generatedToken}
            </code>
            <button className="btn btn-secondary btn-sm" onClick={copyToken} style={{ flexShrink: 0 }}>
              <Copy size={14} />
              <span style={{ fontSize: '0.7rem' }}>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>
      )}

      {loading && keys.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading keys...</div>
      ) : keys.length === 0 && !generatedToken ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No active API tokens. Generate one to enable scripting access.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.5rem', fontWeight: 600, textAlign: 'left' }}>Name</th>
                <th style={{ padding: '0.5rem', fontWeight: 600, textAlign: 'left' }}>Token Prefix</th>
                <th style={{ padding: '0.5rem', fontWeight: 600, textAlign: 'left' }}>Created</th>
                <th style={{ padding: '0.5rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{key.name}</td>
                  <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'var(--terminal-font)', fontSize: '0.75rem', color: 'var(--accent)' }}>{key.prefix}...</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {new Date(key.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                    <button className="btn btn-danger btn-sm" onClick={() => handleRevoke(key.id)} style={{ padding: '0.15rem 0.4rem' }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0,
          width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1.5rem', backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--accent)', marginBottom: '0.25rem' }}>Generate API Token</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Enter a descriptive name to identify this token later.</p>
            <form onSubmit={handleCreateKey}>
              <div className="form-group">
                <label htmlFor="key-name">Token Name</label>
                <input type="text" id="key-name" className="input-field" placeholder="e.g. HomeAssistant Sync" value={keyName} onChange={(e) => setKeyName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="key-expires">Expiration (days, leave empty for no expiry)</label>
                <input type="number" id="key-expires" className="input-field" placeholder="e.g. 365" min={1} value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Generating...' : 'Generate Token'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
