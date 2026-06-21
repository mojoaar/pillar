'use client';

import React, { useState } from 'react';
import { Terminal, Plus, Trash2, Edit2, Share2, Key, Shield, User, Globe, HelpCircle } from 'lucide-react';

interface ConnectionModel {
  id: string;
  name: string;
  host: string;
  domain?: string | null;
  port: number;
  protocol?: 'SSH' | 'VNC' | 'RDP';
  tags: string[]; // comma-separated tags array
  username: string;
  authType: 'PASSWORD' | 'KEY';
  isShared: boolean;
  userId: string;
}

interface UserModel {
  id: string;
  name: string;
  email: string;
}

interface ConnectionsCatalogProps {
  initialConnections: ConnectionModel[];
  users: UserModel[];
  currentUserId: string;
}

export default function ConnectionsCatalog({
  initialConnections,
  users,
  currentUserId,
}: ConnectionsCatalogProps) {
  const [connections, setConnections] = useState<ConnectionModel[]>(initialConnections);
  
  // Modals / forms state
  const [showModal, setShowModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  
  const [editingConnection, setEditingEditingConnection] = useState<ConnectionModel | null>(null);
  const [sharingConnection, setSharingConnection] = useState<ConnectionModel | null>(null);
  
  // Modal Fields
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [domain, setDomain] = useState('');
  const [port, setPort] = useState(22);
  const [protocol, setProtocol] = useState<'SSH' | 'VNC' | 'RDP'>('SSH');
  const [tagsString, setTagsString] = useState(''); // Text input for creating tags (comma separated)
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<'PASSWORD' | 'KEY'>('PASSWORD');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');

  // Filtering Connections (Finding #tags-filter)
  const [selectedTag, setSelectedTag] = useState('');

  // Share Modal Fields
  const [shareUserId, setShareUserId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setHost('');
    setDomain('');
    setPort(22);
    setProtocol('SSH');
    setTagsString(''); // Clear tags text
    setUsername('root');
    setAuthType('PASSWORD');
    setPassword('');
    setPrivateKey('');
    setPassphrase('');
    setEditingEditingConnection(null);
    setError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEdit = (conn: ConnectionModel) => {
    setEditingEditingConnection(conn);
    setName(conn.name);
    setHost(conn.host);
    setDomain(conn.domain || '');
    setPort(conn.port);
    setProtocol(conn.protocol || 'SSH');
    setTagsString(conn.tags ? conn.tags.join(', ') : ''); // Populate tags string
    setUsername(conn.username);
    setAuthType(conn.authType);
    setPassword(''); // never leak password back (Gotcha #113)
    setPrivateKey(''); // never leak private key back
    setPassphrase('');
    setError(null);
    setShowModal(true);
  };

  const handleOpenShare = (conn: ConnectionModel) => {
    setSharingConnection(conn);
    setShareUserId(users[0]?.id || '');
    setError(null);
    setShowShareModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || !host || !username) {
      setError('Connection Name, Host, and Username are required.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name,
        host,
        domain: domain || null,
        port: Number(port),
        protocol, // include protocol parameter (SSH / VNC / RDP)
        tags: tagsString, // Send tags string (Finding #tags)
        username,
        authType,
        password: authType === 'PASSWORD' ? password : null,
        privateKey: authType === 'KEY' ? privateKey : null,
        passphrase: authType === 'KEY' ? passphrase : null,
      };

      const url = editingConnection 
        ? `/api/connections/${editingConnection.id}`
        : '/api/connections';
      
      const method = editingConnection ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save connection profile.');
      }

      // Reload connections list
      const listRes = await fetch('/api/connections');
      if (listRes.ok) {
        const listData = await listRes.json();
        setConnections(listData.data || []);
      }

      setShowModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this SSH connection profile?')) {
      return;
    }

    try {
      const res = await fetch(`/api/connections/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete connection profile.');
      }

      setConnections(connections.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete connection.');
    }
  };

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharingConnection || !shareUserId) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/connections/${sharingConnection.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: shareUserId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to share connection profile.');
      }

      alert('Connection profile shared successfully!');
      setShowShareModal(false);
      setSharingConnection(null);
    } catch (err: any) {
      setError(err.message || 'Failed to share.');
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Tag Aggregation (Finding #tags)
  const allUniqueTags = Array.from(
    new Set(connections.flatMap((c) => c.tags || []))
  ).sort();

  // Filter connections by active selected tag pill (Finding #tags-filter)
  const filteredConnections = selectedTag
    ? connections.filter((c) => c.tags && c.tags.includes(selectedTag))
    : connections;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Catalog controls */}
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Connections Catalog
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Securely save and organize endpoints for quick gateway launches.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <Plus size={18} />
          <span>New Connection</span>
        </button>
      </div>

      {/* Quick-Filter Toolbar Row (Finding #tags-filter-bar) */}
      {allUniqueTags.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '0.75rem',
          marginTop: '-0.5rem'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '0.5rem' }}>
            Filter:
          </span>
          <button
            onClick={() => setSelectedTag('')}
            className="btn btn-sm"
            style={{
              backgroundColor: selectedTag === '' ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: selectedTag === '' ? 'var(--bg-primary)' : 'var(--text-primary)',
              borderRadius: '9999px',
              border: '1px solid var(--border)',
              padding: '0.2rem 0.75rem',
              cursor: 'pointer'
            }}
          >
            All
          </button>
          {allUniqueTags.map((tag) => {
            const isSelected = selectedTag === tag;
            return (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className="btn btn-sm"
                style={{
                  backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg-tertiary)',
                  color: isSelected ? 'var(--bg-primary)' : 'var(--text-primary)',
                  borderRadius: '9999px',
                  border: '1px solid var(--border)',
                  padding: '0.2rem 0.75rem',
                  cursor: 'pointer'
                }}
              >
                #{tag}
              </button>
            );
          })}
        </div>
      )}

      {/* Connection Grid list */}
      <div className="grid-3" style={{ marginTop: '0.5rem' }}>
        {filteredConnections.length === 0 ? (
          <div className="card" style={{ gridColumn: 'span 3', textAlign: 'center', padding: '4rem 2rem' }}>
            <Terminal size={48} style={{ color: 'var(--border)', marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No Connection Profiles Found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '380px', margin: '0 auto 1.5rem' }}>
              No connection profiles match the selected tag filter.
            </p>
            <button className="btn btn-primary" onClick={handleOpenCreate}>
              Create your first profile →
            </button>
          </div>
        ) : (
          filteredConnections.map((conn) => {
            const isOwner = conn.userId === currentUserId;
            return (
              <div key={conn.id} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
                <div className="flex-between">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {conn.protocol === 'VNC' ? (
                      <span style={{ color: 'var(--success)', display: 'flex' }}>📺</span>
                    ) : conn.protocol === 'RDP' ? (
                      <span style={{ color: 'var(--accent)', display: 'flex' }}>🖥️</span>
                    ) : (
                      <Terminal size={20} style={{ color: 'var(--accent)' }} />
                    )}
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>{conn.name}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <span className="badge" style={{ fontSize: '0.65rem', backgroundColor: 'var(--bg-tertiary)' }}>
                      {conn.protocol || 'SSH'}
                    </span>
                    <span className={`badge ${conn.authType === 'PASSWORD' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                      {conn.authType === 'PASSWORD' ? 'Password' : 'Key'}
                    </span>
                  </div>
                </div>

                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div className="flex-align-center">
                    <User size={14} style={{ color: 'var(--text-muted)' }} />
                    <span>Username: <strong>{conn.username}</strong></span>
                  </div>
                  <div className="flex-align-center">
                    <Globe size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontFamily: 'var(--terminal-font)' }}>{conn.host}:{conn.port}</span>
                  </div>
                  {conn.domain && (
                    <div className="flex-align-center">
                      <Globe size={14} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontFamily: 'var(--terminal-font)', color: 'var(--accent)', fontSize: '0.8rem' }}>{conn.domain}</span>
                    </div>
                  )}
                  {conn.tags && conn.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                      {conn.tags.map((tag) => (
                        <span
                          key={tag}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedTag(tag);
                          }}
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-tertiary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer'
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                 <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                  <a href={conn.protocol === 'VNC' ? `/connections/vnc/${conn.id}` : conn.protocol === 'RDP' ? `/connections/rdp/${conn.id}` : `/connections/${conn.id}`} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                    Connect
                  </a>

                  {isOwner && (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleOpenShare(conn)} title="Share connection profile with users">
                        <Share2 size={14} />
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(conn)} title="Edit profile settings">
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(conn.id)} title="Delete profile">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* modal block (zero Tailwind — using inline structural overlay styling) */}
      {showModal && (
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
          <div className="card" style={{ width: '100%', maxWidth: '540px', overflowY: 'auto', maxHeight: '90vh' }}>
            <h3 style={{ fontSize: '1.5rem', color: 'var(--accent)', marginBottom: '0.25rem' }}>
              {editingConnection ? 'Modify Connection' : 'New Connection Profile'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              All connection passwords and private keys are encrypted with AES-256-GCM.
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

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="conn-protocol">Connection Protocol</label>
                <select
                  id="conn-protocol"
                  className="input-field"
                  value={protocol}
                  onChange={(e) => {
                    const newProto = e.target.value as 'SSH' | 'VNC' | 'RDP';
                    setProtocol(newProto);
                    // Dynamically update standard ports
                    if (newProto === 'VNC') setPort(5900);
                    else if (newProto === 'RDP') setPort(3389);
                    else setPort(22);
                    
                    if (newProto === 'VNC' || newProto === 'RDP') {
                      setAuthType('PASSWORD');
                    }
                  }}
                  disabled={loading}
                  style={{ cursor: 'pointer' }}
                >
                  <option value="SSH">SSH — Secure Terminal Access</option>
                  <option value="VNC">VNC — Browser-Based Desktop Viewer</option>
                  <option value="RDP">RDP — Windows/Linux Remote Desktop Console</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="conn-name">Display Name</label>
                <input
                  type="text"
                  id="conn-name"
                  className="input-field"
                  placeholder="e.g. Raspberry Pi Cluster"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="conn-tags">Profile Tags <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional, comma-separated)</span></label>
                <input
                  type="text"
                  id="conn-tags"
                  className="input-field"
                  placeholder="e.g. prod, web, cluster"
                  value={tagsString}
                  onChange={(e) => setTagsString(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label htmlFor="conn-host">Host / IP</label>
                  <input
                    type="text"
                    id="conn-host"
                    className="input-field"
                    placeholder="192.168.1.50"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="conn-domain">Domain <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional)</span></label>
                  <input
                    type="text"
                    id="conn-domain"
                    className="input-field"
                    placeholder="e.g. pve.home.arpa"
                    value={domain || ''}
                    onChange={(e) => setDomain(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label htmlFor="conn-port">Port</label>
                  <input
                    type="number"
                    id="conn-port"
                    className="input-field"
                    placeholder="22"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="conn-username">Username</label>
                <input
                  type="text"
                  id="conn-username"
                  className="input-field"
                  placeholder={protocol === 'VNC' ? 'admin' : 'root'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              {protocol === 'SSH' && (
                <div className="form-group">
                  <label>Authentication Handler</label>
                  <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input
                        type="radio"
                        name="authType"
                        checked={authType === 'PASSWORD'}
                        onChange={() => setAuthType('PASSWORD')}
                        disabled={loading}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>Password</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input
                        type="radio"
                        name="authType"
                        checked={authType === 'KEY'}
                        onChange={() => setAuthType('KEY')}
                        disabled={loading}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>Private Key</span>
                    </label>
                  </div>
                </div>
              )}

              {authType === 'PASSWORD' ? (
                <div className="form-group">
                  <label htmlFor="conn-password">
                    Password {editingConnection && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Leave blank to keep current)</span>}
                  </label>
                  <input
                    type="password"
                    id="conn-password"
                    className="input-field"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required={!editingConnection}
                  />
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label htmlFor="conn-pkey">
                      Private Key {editingConnection && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Leave blank to keep current)</span>}
                    </label>
                    <textarea
                      id="conn-pkey"
                      className="input-field"
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                      rows={4}
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      disabled={loading}
                      required={!editingConnection}
                      style={{ fontFamily: 'var(--terminal-font)', fontSize: '0.75rem', resize: 'vertical' }}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="conn-passphrase">Key Passphrase <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional)</span></label>
                    <input
                      type="password"
                      id="conn-passphrase"
                      className="input-field"
                      placeholder="e.g. MyKeySecret"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving Profile...' : editingConnection ? 'Apply Changes' : 'Create SSH Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Modal block */}
      {showShareModal && sharingConnection && (
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
            <h3 style={{ fontSize: '1.25rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>
              Share connection profile
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Select a local user to share <strong>{sharingConnection.name}</strong> with. They will be able to launch terminals on this node, but will never be able to inspect decrypted passwords or private keys.
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

            {users.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  No other local users registered in system.
                </p>
                <button type="button" className="btn btn-secondary" style={{ width: '120px' }} onClick={() => setShowShareModal(false)}>
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleShareSubmit}>
                <div className="form-group">
                  <label htmlFor="share-user">Target User</label>
                  <select
                    id="share-user"
                    className="input-field"
                    value={shareUserId}
                    onChange={(e) => setShareUserId(e.target.value)}
                    disabled={loading}
                    required
                    style={{ cursor: 'pointer' }}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowShareModal(false)} disabled={loading}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Sharing...' : 'Authorize Share'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
