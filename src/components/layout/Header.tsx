'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Sun, Moon, Terminal, X, ShieldAlert, Radio } from 'lucide-react';
import { formatDateTime } from '@/lib/datetime';
import styles from './Header.module.css';

interface HeaderProps {
  user: {
    name: string;
    email: string;
    username: string;
    role: string;
  };
}

interface SessionData {
  sessionId: string;
  username: string;
  host: string;
  startedAt: string;
}

export default function Header({ user }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [sessionCount, setSessionCount] = useState(0);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);

  const fetchSessionCount = async () => {
    try {
      const res = await fetch('/api/admin/metrics');
      if (res.ok) {
        const data = await res.json();
        if (data && data.data) {
          setSessionCount(data.data.activeSessions || 0);
          setSessions(data.data.sessions || []);
        }
      }
    } catch (err) {
      // Silently capture errors
    }
  };

  // Poll for active session counts and details
  useEffect(() => {
    fetchSessionCount();
    const interval = setInterval(fetchSessionCount, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, []);

  const handleOpenSessionsModal = async () => {
    // Only administrators may inspect active connection streams (Security privacy barrier)
    if (user.role === 'ADMIN' && sessionCount > 0) {
      await fetchSessionCount(); // Instantly poll for fresh accurate metrics to eliminate HMR/double-mount lags! (Finding #session-lag)
      setShowSessionsModal(true);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    if (!confirm(`🚨 FORCE TERMINATION: Are you sure you want to immediately terminate WebSocket tunnel session ID: ${sessionId}? This will instantly disconnect the user's terminal.`)) {
      return;
    }

    setTerminatingId(sessionId);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to terminate session.');
      }

      // Reload sessions list
      await fetchSessionCount();
      
      if (sessionCount <= 1) {
        setShowSessionsModal(false);
      }
    } catch (err: any) {
      alert(err.message || 'Operation failed.');
    } finally {
      setTerminatingId(null);
    }
  };

  const isAdmin = user.role === 'ADMIN';

  return (
    <header className={styles.header}>
      {/* Page Title & Breadcrumbs */}
      <div className={styles.leftSection}>
        <span className={styles.pageTitle}>Connection Portal</span>
      </div>

      {/* Control items & selectors */}
      <div className={styles.rightSection}>
        {/* Active sessions diagnostic indicator */}
        <button 
          onClick={handleOpenSessionsModal}
          className={styles.activeSessionsBadge} 
          title={isAdmin && sessionCount > 0 ? "Click to inspect and manage active connection tunnels" : "Active terminal gateway sessions"}
          style={{
            cursor: (isAdmin && sessionCount > 0) ? 'pointer' : 'default',
            border: '1px solid var(--border)',
            background: 'var(--bg-tertiary)',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.75rem',
            borderRadius: 'var(--border-radius)',
            transition: 'all 0.15s ease'
          }}
          disabled={!isAdmin || sessionCount === 0}
        >
          <div className={styles.activeIndicator} />
          <span>{sessionCount} SSH session{sessionCount !== 1 ? 's' : ''}</span>
        </button>

        <div className={styles.controlGroup}>
          {/* Quick sun/moon toggle */}
          <button 
            onClick={toggleTheme} 
            className={styles.themeToggleBtn}
            title="Toggle theme (Light / Dark)"
          >
            {theme.endsWith('-dark') ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      {/* Active Sessions Control Modal Overlay */}
      {showSessionsModal && isAdmin && (
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
          zIndex: 10000,
          padding: '1.5rem',
          backdropFilter: 'blur(4px)',
          color: 'var(--text-primary)'
        }} onClick={() => setShowSessionsModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={22} style={{ color: 'var(--danger)' }} />
                <span>Active Connection Sockets</span>
              </h3>
              <button className="btn btn-ghost" style={{ padding: '0.25rem' }} onClick={() => setShowSessionsModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '340px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.5rem', fontWeight: 600 }}>Session ID</th>
                    <th style={{ padding: '0.5rem', fontWeight: 600 }}>Active User</th>
                    <th style={{ padding: '0.5rem', fontWeight: 600 }}>Remote Target</th>
                    <th style={{ padding: '0.5rem', fontWeight: 600 }}>Start Time</th>
                    <th style={{ padding: '0.5rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((sess) => (
                    <tr key={sess.sessionId} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'var(--terminal-font)', color: 'var(--accent)', fontSize: '0.75rem' }}>
                        {sess.sessionId}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>
                        {sess.username}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'var(--terminal-font)', fontSize: '0.75rem' }}>
                        {sess.host}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                        {formatDateTime(sess.startedAt, { dateFormat: 'EU' }).split(' ')[1] || 'Unknown'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleTerminateSession(sess.sessionId)}
                          disabled={terminatingId === sess.sessionId}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          {terminatingId === sess.sessionId ? 'Stopping...' : 'Terminate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
