'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Users, Plus, Shield, Ban, CheckCircle, Trash2, Key, HelpCircle, X, ShieldAlert, ArrowLeft } from 'lucide-react';

interface UserModel {
  id: string;
  email: string;
  name: string | null;
  username: string;
  role: string;
  mfaEnabled: boolean;
  isSuspended: boolean;
  allowedPlugins?: string | null; // comma-separated plugin IDs authorized for this user
  createdAt: string;
}

interface UserManagerProps {
  initialUsers: UserModel[];
  currentUserId: string;
}

export default function UserManager({ initialUsers, currentUserId }: UserManagerProps) {
  const [users, setUsers] = useState<UserModel[]>(initialUsers);
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');

  // Manage Plugins Modal State
  const [showPluginsModal, setShowPluginsModal] = useState(false);
  const [pluginTargetUser, setPluginTargetUser] = useState<UserModel | null>(null);
  const [selectedPlugins, setSelectedPlugins] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('USER');
    setError(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || !username || !email || !password) {
      setError('All fields are required.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, email, password, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user.');
      }

      // Reload list
      const listRes = await fetch('/api/admin/users');
      if (listRes.ok) {
        const listData = await listRes.json();
        setUsers(listData.data || []);
      }

      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle suspension state
  const handleToggleSuspend = async (user: UserModel) => {
    const action = user.isSuspended ? 'unsuspend' : 'suspend';
    if (!confirm(`Are you sure you want to ${action} account: ${user.username}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSuspended: !user.isSuspended }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operation failed.');

      setUsers(users.map((u) => (u.id === user.id ? { ...u, isSuspended: data.data.isSuspended } : u)));
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Change account role
  const handleChangeRole = async (user: UserModel, targetRole: 'ADMIN' | 'USER') => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: targetRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operation failed.');

      setUsers(users.map((u) => (u.id === user.id ? { ...u, role: data.data.role } : u)));
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Administrative MFA Override (reset TOTP)
  const handleResetMfa = async (user: UserModel) => {
    if (!confirm(`⚠️ WARNING: You are initiating an administrative MFA Override on ${user.username}. This will completely disable their authenticator device and clear their secret key. Proceed?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetMfa: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'MFA reset failed.');

      setUsers(users.map((u) => (u.id === user.id ? { ...u, mfaEnabled: false } : u)));
      alert('MFA device setup cleared successfully! The user can now log in using password credentials and re-enroll.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete user account
  const handleDeleteUser = async (user: UserModel) => {
    if (!confirm(`🚨 PERMANENT ACCOUNT DELETION: Are you absolutely sure you want to permanently delete account: ${user.username}? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user.');

      setUsers(users.filter((u) => u.id !== user.id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Open Manage Plugins modal for user
  const handleOpenPluginsModal = (user: UserModel) => {
    setPluginTargetUser(user);
    const userPlugins = user.allowedPlugins ? user.allowedPlugins.split(',').map(p => p.trim()) : [];
    setSelectedPlugins(userPlugins);
    setShowPluginsModal(true);
  };

  // Save authorized plugins list for user
  const handleSavePlugins = async () => {
    if (!pluginTargetUser) return;
    setLoading(true);

    try {
      const allowedStr = selectedPlugins.join(',');
      const res = await fetch(`/api/admin/users/${pluginTargetUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedPlugins: allowedStr }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update plugin settings.');

      // Update local state
      setUsers(users.map((u) => (u.id === pluginTargetUser.id ? { ...u, allowedPlugins: allowedStr } : u)));
      setShowPluginsModal(false);
      setPluginTargetUser(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update user plugins.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Title */}
      <div className="flex-between">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
          <Link href="/admin" className="btn btn-secondary btn-sm" title="Back to Admin Panel Overview">
            <ArrowLeft size={14} />
            <span>Back to Panel</span>
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users style={{ color: 'var(--accent)' }} />
            <span>User Accounts Dashboard</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Register new users, toggle roles, suspend active accounts, and perform TOTP MFA overrides.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => { resetForm(); setShowCreateModal(true); }}>
          <Plus size={18} />
          <span>Create Local Account</span>
        </button>
      </div>

      {/* Users List Card */}
      <div className="card" style={{ padding: '1rem 1.5rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>Active User</th>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>Username</th>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>Role</th>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>MFA</th>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', opacity: u.isSuspended ? 0.6 : 1 }}>
                    {/* User display details */}
                    <td style={{ padding: '1rem 0.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {u.name || 'Unnamed User'} {isSelf && <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 500 }}>(You)</span>}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</span>
                      </div>
                    </td>

                    {/* Username */}
                    <td style={{ padding: '1rem 0.5rem', fontFamily: 'var(--terminal-font)', fontSize: '0.85rem' }}>
                      {u.username}
                    </td>

                    {/* Role swap dropdown */}
                    <td style={{ padding: '1rem 0.5rem' }}>
                      {isSelf ? (
                        <span className="badge badge-danger">ADMIN</span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => handleChangeRole(u, e.target.value as 'ADMIN' | 'USER')}
                          className="input-field"
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem',
                            width: '90px',
                            cursor: 'pointer',
                            backgroundColor: u.role === 'ADMIN' ? 'rgba(255, 85, 85, 0.05)' : 'var(--bg-tertiary)',
                            borderColor: u.role === 'ADMIN' ? 'var(--danger)' : 'var(--border)'
                          }}
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      )}
                    </td>

                    {/* MFA badge status */}
                    <td style={{ padding: '1rem 0.5rem' }}>
                      <span className={`badge ${u.mfaEnabled ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                        {u.mfaEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: '1rem 0.5rem' }}>
                      <span className={`badge ${u.isSuspended ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.7rem' }}>
                        {u.isSuspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>

                    {/* Actions block */}
                    <td style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {/* MFA Reset trigger */}
                        {u.mfaEnabled && !isSelf && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleResetMfa(u)}
                            title="Perform administrative MFA Override (disable TOTP)"
                            style={{ padding: '0.25rem 0.4rem' }}
                          >
                            <Key size={14} />
                            <span style={{ fontSize: '0.75rem' }}>Reset MFA</span>
                          </button>
                        )}

                        {!isSelf && u.role === 'USER' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenPluginsModal(u)}
                            title="Configure Authorized Plugins for this user"
                            style={{ padding: '0.25rem 0.4rem' }}
                          >
                            <span style={{ fontSize: '14px', lineHeight: 1 }}>🔌</span>
                            <span style={{ fontSize: '0.75rem' }}>Plugins</span>
                          </button>
                        )}

                        {!isSelf && (
                          <>
                            {/* Suspend button toggle */}
                            <button
                              className={`btn ${u.isSuspended ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                              onClick={() => handleToggleSuspend(u)}
                              title={u.isSuspended ? 'Re-activate account' : 'Suspend account'}
                              style={{ padding: '0.25rem 0.4rem' }}
                            >
                              {u.isSuspended ? <CheckCircle size={14} /> : <Ban size={14} />}
                              <span style={{ fontSize: '0.75rem' }}>{u.isSuspended ? 'Activate' : 'Suspend'}</span>
                            </button>

                            {/* Delete button trigger */}
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteUser(u)}
                              title="Permanently delete user account"
                              style={{ padding: '0.25rem' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Creation Modal block */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1.5rem',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px' }}>
            <h3 style={{ fontSize: '1.5rem', color: 'var(--accent)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={22} style={{ color: 'var(--accent)' }} />
              <span>New Local Account</span>
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Create a new user. They can set up MFA after their very first login.
            </p>

            {error && (
              <div style={{
                backgroundColor: 'rgba(255, 85, 85, 0.1)',
                border: '1px solid var(--danger)',
                color: 'var(--danger)',
                padding: '0.75rem',
                borderRadius: 'var(--border-radius)',
                fontSize: '0.85rem',
                marginBottom: '1rem',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label htmlFor="create-name">Display Name</label>
                <input
                  type="text"
                  id="create-name"
                  className="input-field"
                  placeholder="e.g. Sarah K."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="create-username">Username</label>
                <input
                  type="text"
                  id="create-username"
                  className="input-field"
                  placeholder="sarah"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="create-email">Email Address</label>
                <input
                  type="email"
                  id="create-email"
                  className="input-field"
                  placeholder="sarah@homelab.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="create-password">Password (min 8 chars)</label>
                <input
                  type="password"
                  id="create-password"
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="create-role">Access Scope Role</label>
                <select
                  id="create-role"
                  className="input-field"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={loading}
                  required
                  style={{ cursor: 'pointer' }}
                >
                  <option value="USER">USER — Access to own & shared profiles only</option>
                  <option value="ADMIN">ADMIN — Complete administrative permissions</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creating Account...' : 'Register Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plugin Authorization Modal block */}
      {showPluginsModal && pluginTargetUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1.5rem',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px' }}>
            <h3 style={{ fontSize: '1.5rem', color: 'var(--accent)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔌</span>
              <span>Manage User Plugins</span>
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Select which optional plugins standard user <strong>{pluginTargetUser.username}</strong> is authorized to access.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1.5rem 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedPlugins.includes('proxmox-ve')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPlugins([...selectedPlugins, 'proxmox-ve']);
                    } else {
                      setSelectedPlugins(selectedPlugins.filter((p) => p !== 'proxmox-ve'));
                    }
                  }}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ fontSize: '0.95rem' }}>Proxmox VE Plugin</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Grant access to view and cycle VM instances</span>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowPluginsModal(false); setPluginTargetUser(null); }} disabled={loading}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSavePlugins} disabled={loading}>
                {loading ? 'Saving Settings...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
