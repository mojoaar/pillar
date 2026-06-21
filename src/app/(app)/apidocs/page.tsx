'use client';

import React, { useState } from 'react';
import { Code, Shield, Key, Eye, HelpCircle, ArrowRight, Play } from 'lucide-react';

interface APIEndpoint {
  id: string;
  group: 'Auth' | 'Connections' | 'Profiles' | 'Admin' | 'Health';
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  desc: string;
  auth: 'Public' | 'USER' | 'ADMIN';
  headers?: Record<string, string>;
  reqBody?: any;
  resBody: any;
  queryParams?: Record<string, string>;
}

// Full specifications catalog of all REST API routes in Pillar
const apiSpecs: APIEndpoint[] = [
  {
    id: 'setup',
    group: 'Auth',
    method: 'POST',
    path: '/api/setup',
    desc: 'Initialize the gateway by registering the first ADMIN account. Single-use only — safely disabled once any user account is seeded in the SQLite database.',
    auth: 'Public',
    reqBody: {
      name: 'Alex M.',
      email: 'admin@homelab.local',
      username: 'admin',
      password: 'MyPassword123'
    },
    resBody: {
      data: {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        email: 'admin@homelab.local',
        username: 'admin',
        role: 'ADMIN',
        createdAt: '2026-06-21T07:15:30.000Z'
      },
      ok: true
    }
  },
  {
    id: 'login',
    group: 'Auth',
    method: 'POST',
    path: '/api/auth/signin',
    desc: 'Verify standard email + password login credentials. If TOTP MFA is enabled on the account, throws a special "MFA_REQUIRED" validation error prompting the client form to reveal the 6-digit TOTP challenge sub-step.',
    auth: 'Public',
    reqBody: {
      email: 'admin@homelab.local',
      password: 'MyPassword123',
      totpCode: '123456 (Required if MFA is enabled)'
    },
    resBody: {
      user: {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        email: 'admin@homelab.local',
        name: 'Alex M.',
        role: 'ADMIN'
      },
      ok: true
    }
  },
  {
    id: 'get-connections',
    group: 'Connections',
    method: 'GET',
    path: '/api/connections',
    desc: 'List all SSH connection profiles belonging directly to the active session user OR explicitly shared with them. Enforces BOLA boundaries (Broken Object-Level Authorization), safely stripping all passwords and private key buffers from outputs.',
    auth: 'USER',
    resBody: {
      data: [
        {
          id: '5f92e850-ea9f-4318-97e3-0d31293fb6a1',
          userId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
          name: 'nas-cluster-01',
          host: '192.168.1.20',
          port: 22,
          username: 'admin',
          authType: 'PASSWORD',
          isShared: false,
          createdAt: '2026-06-21T07:22:15.000Z'
        }
      ],
      ok: true
    }
  },
  {
    id: 'create-connection',
    group: 'Connections',
    method: 'POST',
    path: '/api/connections',
    desc: 'Save a new SSH connection profile. Sensitive fields (passwords, private keys, key passphrases) are dynamically encrypted using AES-256-GCM before database write operations, backed by ENCRYPTION_KEY.',
    auth: 'USER',
    reqBody: {
      name: 'pi-hole',
      host: '192.168.1.15',
      port: 22,
      username: 'pi',
      authType: 'PASSWORD',
      password: 'RaspberryPassword'
    },
    resBody: {
      data: {
        id: '2a1fec58-8b9d-43fd-9ae8-d621ba5f2bd6',
        name: 'pi-hole',
        host: '192.168.1.15',
        port: 22,
        username: 'pi',
        authType: 'PASSWORD'
      },
      ok: true
    }
  },
  {
    id: 'update-connection',
    group: 'Connections',
    method: 'PATCH',
    path: '/api/connections/[id]',
    desc: 'Update existing SSH connection parameters. Enforces BOLA owner checks. If credentials (password or private keys) are modified, they are re-encrypted at rest before database modification.',
    auth: 'USER',
    reqBody: {
      name: 'pi-hole-updated',
      host: '192.168.1.16',
      port: 22,
      authType: 'KEY',
      privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----...'
    },
    resBody: {
      data: {
        id: '2a1fec58-8b9d-43fd-9ae8-d621ba5f2bd6',
        name: 'pi-hole-updated',
        host: '192.168.1.16',
        port: 22,
        username: 'pi',
        authType: 'KEY'
      },
      ok: true
    }
  },
  {
    id: 'delete-connection',
    group: 'Connections',
    method: 'DELETE',
    path: '/api/connections/[id]',
    desc: 'Permanently delete an SSH connection profile. Cleanly cascading-deletes all associated SharedConnection access joins. Only connection owners can invoke deletion.',
    auth: 'USER',
    resBody: {
      ok: true,
      message: 'Connection profile deleted successfully.'
    }
  },
  {
    id: 'share-connection',
    group: 'Connections',
    method: 'POST',
    path: '/api/connections/[id]/share',
    desc: 'Share your owned SSH profile with another local user. Enables the target user to establish SSH terminal tunnels, but securely blocks them from ever inspecting the decrypted private keys or passwords.',
    auth: 'USER',
    reqBody: {
      userId: '7b5aed1e-caef-42bc-9d32-d2b1f83acd14'
    },
    resBody: {
      ok: true,
      message: 'SSH profile shared with sarah.'
    }
  },
  {
    id: 'update-profile',
    group: 'Profiles',
    method: 'PATCH',
    path: '/api/profile',
    desc: 'Modify account details (display name, username, email, password). Password changes strictly require currentPassword validation to prevent account takeover cycles.',
    auth: 'USER',
    reqBody: {
      name: 'Alex Updated',
      email: 'alex.u@homelab.local',
      currentPassword: 'OldPassword123 (Required only if changing password)',
      newPassword: 'MySecurePassword456'
    },
    resBody: {
      data: {
        id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        name: 'Alex Updated',
        username: 'admin',
        email: 'alex.u@homelab.local',
        role: 'ADMIN',
        avatarUrl: '/uploads/avatars/admin_1718956822.png'
      },
      ok: true
    }
  },
  {
    id: 'avatar-upload',
    group: 'Profiles',
    method: 'POST',
    path: '/api/profile/avatar',
    desc: 'Upload a custom profile avatar image inside multipart/form-data. Restricts uploads to PNG, JPEG, and WEBP formats up to 2MB. Saves to local uploads with a timestamp cache-buster filename.',
    auth: 'USER',
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    resBody: {
      data: {
        avatarUrl: '/uploads/avatars/admin_1718956822.webp'
      },
      ok: true
    }
  },
  {
    id: 'mfa-generate',
    group: 'Profiles',
    method: 'POST',
    path: '/api/profile/mfa/generate',
    desc: 'Initialize TOTP MFA enrollment. Generates a secure 16-character base32 key and returns a scan-ready QR Code data URL. The secret is saved encrypted, but MFA remains disabled until verified.',
    auth: 'USER',
    resBody: {
      data: {
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
      },
      ok: true
    }
  },
  {
    id: 'mfa-verify',
    group: 'Profiles',
    method: 'POST',
    path: '/api/profile/mfa/verify',
    desc: 'Verify a 6-digit TOTP validation token against the generated secret. On success, permanently sets mfaEnabled = true on the user account.',
    auth: 'USER',
    reqBody: {
      code: '123456'
    },
    resBody: {
      ok: true,
      message: 'Multi-Factor Authentication enabled successfully!'
    }
  },
  {
    id: 'get-metrics',
    group: 'Admin',
    method: 'GET',
    path: '/api/admin/metrics',
    desc: 'Fetch host system hardware diagnostic parameters including current CPU load average, RAM utilization arrays, active WebSocket gateway sessions, and uptime tickers.',
    auth: 'ADMIN',
    resBody: {
      data: {
        cpuLoad: 23.5,
        freeMem: 11840221184,
        totalMem: 17179869184,
        uptime: 1228492,
        activeSessions: 2
      },
      ok: true
    }
  },
  {
    id: 'terminate-session',
    group: 'Admin',
    method: 'DELETE',
    path: '/api/admin/sessions/[id]',
    desc: 'Forcefully disconnect and terminate an active, running WebSocket SSH or VNC remote session tunnel by its session ID. Restricted to administrators (ADMIN role) only.',
    auth: 'ADMIN',
    resBody: {
      ok: true,
      message: 'Active session terminated successfully.'
    }
  },
  {
    id: 'list-users',
    group: 'Admin',
    method: 'GET',
    path: '/api/admin/users',
    desc: 'Fetch all registered local user accounts. Returns email, username, name, role, MFA status, suspension state, and allowed plugins. Restricted to administrators (ADMIN role) only.',
    auth: 'ADMIN',
    resBody: {
      data: [{ id: 'uuid', email: 'user@homelab.local', username: 'john', role: 'USER', mfaEnabled: true, isSuspended: false, allowedPlugins: 'proxmox-ve' }],
      ok: true
    }
  },
  {
    id: 'create-user',
    group: 'Admin',
    method: 'POST',
    path: '/api/admin/users',
    desc: 'Register a new local user account. Accepts name, email, username, password (min 8 chars), and role (ADMIN or USER). Restricted to administrators (ADMIN role) only.',
    auth: 'ADMIN',
    reqBody: { name: 'Sarah K.', email: 'sarah@homelab.local', username: 'sarah', password: 'securepassword', role: 'USER' },
    resBody: { data: { id: 'uuid', email: 'sarah@homelab.local', username: 'sarah', role: 'USER' }, ok: true }
  },
  {
    id: 'update-user',
    group: 'Admin',
    method: 'PATCH',
    path: '/api/admin/users/[id]',
    desc: 'Modify user account settings. Supports role changes, suspension toggles, MFA overrides (disabling TOTP), and plugin access grants via allowedPlugins. Restricted to administrators (ADMIN role) only.',
    auth: 'ADMIN',
    reqBody: { role: 'ADMIN', isSuspended: false, resetMfa: true, allowedPlugins: 'proxmox-ve' },
    resBody: { data: { id: 'uuid', role: 'ADMIN', isSuspended: false, mfaEnabled: false }, ok: true }
  },
  {
    id: 'delete-user',
    group: 'Admin',
    method: 'DELETE',
    path: '/api/admin/users/[id]',
    desc: 'Permanently delete a user account. Cannot delete your own admin account. Restricted to administrators (ADMIN role) only.',
    auth: 'ADMIN',
    resBody: { ok: true, message: 'User account removed permanently.' }
  },
  {
    id: 'manage-plugins',
    group: 'Admin',
    method: 'GET',
    path: '/api/admin/plugins',
    desc: 'List all available plugin integrations with their current enabled states and sanitized configuration fields (passwords masked). Restricted to administrators (ADMIN role) only.',
    auth: 'ADMIN',
    resBody: { data: [{ id: 'proxmox-ve', name: 'Proxmox VE', enabled: true, config: { apiUrl: 'https://pve.local', apiToken: '••••••••', verifySsl: 'false' } }], ok: true }
  },
  {
    id: 'configure-plugin',
    group: 'Admin',
    method: 'PATCH',
    path: '/api/admin/plugins',
    desc: 'Update a plugin configuration and enabled toggle. Config values are encrypted with AES-256-GCM before storage. Password fields are detected via mask matching to retain existing values. Restricted to administrators (ADMIN role) only.',
    auth: 'ADMIN',
    reqBody: { id: 'proxmox-ve', enabled: true, config: { apiUrl: 'https://pve.local:8006/api2/json', apiToken: 'root@pve!token=secret', verifySsl: 'false' } },
    resBody: { message: 'Plugin configured successfully', ok: true }
  },
  {
    id: 'audit-logs',
    group: 'Admin',
    method: 'GET',
    path: '/api/admin/audit',
    desc: 'Fetch paginated, filterable security audit event logs. Supports filtering by userId, event type, and IP. Paginated with limit (max 100) and page offset. Restricted to administrators (ADMIN role) only.',
    auth: 'ADMIN',
    queryParams: { page: '1', limit: '25', userId: 'optional', event: 'optional', ip: 'optional' },
    resBody: { data: [{ id: 'uuid', userId: 'uuid', event: 'Login Succeeded', ip: '192.168.1.1', meta: '{}', createdAt: '2026-06-21T10:00:00Z' }], total: 42, ok: true }
  },
  {
    id: 'api-keys-list',
    group: 'Profiles',
    method: 'GET',
    path: '/api/profile/keys',
    desc: 'List all active personal API tokens for the authenticated user. Returns token name, prefix, creation date, and expiration — never the raw key or hash.',
    auth: 'USER',
    resBody: { data: [{ id: 'uuid', name: 'HomeAssistant', prefix: 'pil_live_ab', createdAt: '2026-06-21T10:00:00Z', expiresAt: null }], ok: true }
  },
  {
    id: 'api-keys-create',
    group: 'Profiles',
    method: 'POST',
    path: '/api/profile/keys',
    desc: 'Generate a new personal API token. The raw token (pil_live_...) is returned exactly once — never stored in plaintext. Hashing uses HMAC-SHA256 with a server pepper.',
    auth: 'USER',
    reqBody: { name: 'HomeAssistant', expiresDays: 365 },
    resBody: { data: { token: 'pil_live_xxxxxxxx', prefix: 'pil_live_ab' }, ok: true }
  },
  {
    id: 'api-keys-delete',
    group: 'Profiles',
    method: 'DELETE',
    path: '/api/profile/keys',
    desc: 'Revoke and permanently delete an API token. The token immediately loses all access. Returns the same error message whether the key exists or belongs to another user — preventing enumeration.',
    auth: 'USER',
    queryParams: { id: 'key-uuid' },
    resBody: { ok: true, message: 'API key revoked permanently.' }
  },
  {
    id: 'proxmox-status',
    group: 'Connections',
    method: 'GET',
    path: '/api/plugins/proxmox',
    desc: 'Fetch real-time Proxmox VE cluster status. Returns node health metrics, running VMs (QEMU), and containers (LXC) with CPU, RAM, and uptime data. Requires the Proxmox VE plugin to be enabled and the user authorized.',
    auth: 'USER',
    resBody: { enabled: true, connected: true, data: { nodes: [{ node: 'pve', status: 'online', cpu: 0.15, mem: 8589934592 }], resources: [{ id: 'qemu/100', name: 'web-server', type: 'qemu', status: 'running', cpu: 0.04, mem: 2147483648 }] }, ok: true }
  },
  {
    id: 'proxmox-lifecycle',
    group: 'Connections',
    method: 'POST',
    path: '/api/plugins/proxmox',
    desc: 'Dispatch power lifecycle commands (start, stop, shutdown, reboot, suspend) to a Proxmox VM or container. Requires the Proxmox VE plugin enabled and user authorized.',
    auth: 'USER',
    reqBody: { node: 'pve', vmid: 100, type: 'qemu', action: 'reboot' },
    resBody: { data: {}, message: 'Lifecycle action reboot dispatched successfully.', ok: true }
  }
];

export default function APIDocsPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint>(apiSpecs[2]); // default to get-connections
  const [tryResponse, setTryResponse] = useState<string | null>(null);
  const [tryLoading, setTryLoading] = useState(false);

  const getMethodStyle = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE') => {
    switch (method) {
      case 'GET': return { bg: 'rgba(80, 250, 123, 0.1)', color: 'var(--success)', border: 'var(--success)' };
      case 'POST': return { bg: 'rgba(189, 147, 249, 0.1)', color: 'var(--accent)', border: 'var(--accent)' };
      case 'PATCH': return { bg: 'rgba(255, 184, 108, 0.1)', color: 'var(--warning)', border: 'var(--warning)' };
      case 'DELETE': return { bg: 'rgba(255, 85, 85, 0.1)', color: 'var(--danger)', border: 'var(--danger)' };
    }
  };

  const handleTestAPI = async () => {
    setTryLoading(true);
    setTryResponse(null);

    try {
      // Simulate real-time API client testing for development representation!
      // Calls standard local endpoints if possible, otherwise outputs pre-rendered specimens
      let fetchUrl = selectedEndpoint.path;
      
      // Handle dynamic parameters simply
      if (fetchUrl.includes('[id]')) {
        fetchUrl = fetchUrl.replace('[id]', 'demo-uuid-token');
      }

      const method = selectedEndpoint.method;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let body: string | undefined = undefined;

      if (selectedEndpoint.reqBody && method !== 'GET') {
        body = JSON.stringify(selectedEndpoint.reqBody);
      }

      const res = await fetch(fetchUrl, { method, headers, body });
      const text = await res.text();
      
      try {
        const json = JSON.parse(text);
        setTryResponse(JSON.stringify(json, null, 2));
      } catch {
        setTryResponse(text || `HTTP Status: ${res.status}`);
      }
    } catch (err: any) {
      // Fallback display specification response on unauthorized or dynamic-id failures
      setTryResponse(JSON.stringify({
        info: 'API Test simulation fallback (real endpoints require active authentication tokens).',
        sampleResponse: selectedEndpoint.resBody
      }, null, 2));
    } finally {
      setTryLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      gap: '2rem',
      height: 'calc(100vh - 120px)',
      width: '100%'
    }}>
      {/* Sidebar List of endpoints (Swagger style) */}
      <aside style={{
        width: '260px',
        flexShrink: 0,
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--border-radius)',
        padding: '1.25rem 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        height: '100%',
        overflowY: 'auto'
      }}>
        {['Auth', 'Connections', 'Profiles', 'Admin'].map((groupName) => (
          <div key={groupName} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <span style={{ 
              fontSize: '0.7rem', 
              fontWeight: 700, 
              color: 'var(--text-muted)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em', 
              paddingLeft: '0.5rem',
              marginBottom: '0.25rem'
            }}>
              {groupName} APIs
            </span>
            
            {apiSpecs
              .filter((spec) => spec.group === groupName)
              .map((spec) => {
                const isSelected = spec.id === selectedEndpoint.id;
                const mStyle = getMethodStyle(spec.method);
                return (
                  <button
                    key={spec.id}
                    onClick={() => { setSelectedEndpoint(spec); setTryResponse(null); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      borderRadius: 'var(--border-radius)',
                      textAlign: 'left',
                      fontSize: '0.825rem',
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                      color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 600 : 500,
                      transition: 'all 0.15s ease',
                      width: '100%'
                    }}
                  >
                    <span style={{ 
                      fontSize: '0.6rem', 
                      fontWeight: 800, 
                      padding: '0.15rem 0.35rem', 
                      borderRadius: '3px',
                      backgroundColor: mStyle.bg,
                      color: mStyle.color,
                      border: `1px solid ${mStyle.color}40`,
                      width: '45px',
                      textAlign: 'center',
                      flexShrink: 0
                    }}>
                      {spec.method}
                    </span>
                    <span style={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      fontFamily: 'var(--terminal-font)',
                      fontSize: '0.725rem'
                    }}>
                      {spec.path.replace('/api', '')}
                    </span>
                  </button>
                );
              })}
          </div>
        ))}
      </aside>

      {/* Main Endpoint Details columns */}
      <article style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--border-radius)',
        padding: '2rem',
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        {/* Endpoint path and description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.8rem',
              fontWeight: 800,
              padding: '0.25rem 0.75rem',
              borderRadius: '4px',
              backgroundColor: getMethodStyle(selectedEndpoint.method).bg,
              color: getMethodStyle(selectedEndpoint.method).color,
              border: `1px solid ${getMethodStyle(selectedEndpoint.method).color}`
            }}>
              {selectedEndpoint.method}
            </span>
            <code style={{
              fontFamily: 'var(--terminal-font)',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary)'
            }}>
              {selectedEndpoint.path}
            </code>

            {/* Auth scope badge */}
            <span className={`badge ${selectedEndpoint.auth === 'ADMIN' ? 'badge-danger' : selectedEndpoint.auth === 'USER' ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Shield size={12} />
              <span>{selectedEndpoint.auth} Scope</span>
            </span>
          </div>
          
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', lineHeight: '1.5', marginTop: '0.25rem' }}>
            {selectedEndpoint.desc}
          </p>
        </div>

        {/* Request Schema specifications */}
        {selectedEndpoint.reqBody && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Request Schema Spec</h4>
            <pre style={{
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--border-radius)',
              padding: '1rem',
              overflow: 'auto',
              fontFamily: 'var(--terminal-font)',
              fontSize: '0.8rem',
              color: 'var(--accent)'
            }}>
              <code>{JSON.stringify(selectedEndpoint.reqBody, null, 2)}</code>
            </pre>
          </div>
        )}

        {/* Spec Response specifications */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Response Spec Sample</h4>
          <pre style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--border-radius)',
            padding: '1rem',
            overflow: 'auto',
            fontFamily: 'var(--terminal-font)',
            fontSize: '0.8rem',
            color: 'var(--success)'
          }}>
            <code>{JSON.stringify(selectedEndpoint.resBody, null, 2)}</code>
          </pre>
        </div>

        {/* Try it interactive console panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-tertiary)', border: '1px dashed var(--border)' }}>
          <div className="flex-between">
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Play size={16} style={{ color: 'var(--accent)' }} />
              <span>Interactive Request Console</span>
            </h4>
            <button className="btn btn-primary btn-sm" onClick={handleTestAPI} disabled={tryLoading}>
              {tryLoading ? 'Executing...' : 'Send Request'}
            </button>
          </div>

          {tryResponse && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Console Output:</span>
              <pre style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--border-radius)',
                padding: '1rem',
                overflow: 'auto',
                fontFamily: 'var(--terminal-font)',
                fontSize: '0.775rem',
                color: 'var(--text-primary)',
                maxHeight: '220px'
              }}>
                <code>{tryResponse}</code>
              </pre>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
