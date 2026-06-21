'use client';

import React, { useState, useEffect } from 'react';
import { useTheme, ThemeName, FontName } from '@/components/theme/ThemeProvider';
import { getDefaultTimezone, DateFormatPreference } from '@/lib/datetime';
import { User, Shield, Sliders, Upload, Check, AlertTriangle, ShieldCheck } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences'>('profile');
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedClock = localStorage.getItem('pillar-clock');
    const savedDate = localStorage.getItem('pillar-date') as DateFormatPreference;
    const savedTz = localStorage.getItem('pillar-timezone');

    if (savedClock) setHour12(savedClock === '12h');
    if (savedDate) setDateFormat(savedDate);
    if (savedTz) setTimezone(savedTz);
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
                <option value="UTC">UTC (Universal Coordinated Time)</option>
                <option value="Europe/Oslo">Europe/Oslo (CET / CEST)</option>
                <option value="Europe/London">Europe/London (GMT / BST)</option>
                <option value="Europe/Paris">Europe/Paris (CET / CEST)</option>
                <option value="America/New_York">America/New_York (EST / EDT)</option>
                <option value="America/Chicago">America/Chicago (CST / CDT)</option>
                <option value="America/Denver">America/Denver (MST / MDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST / PDT)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="Asia/Singapore">Asia/Tokyo (SGT)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST / AEDT)</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Save Application Preferences
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
