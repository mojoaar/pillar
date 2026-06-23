'use client';

import React, { useEffect, useState } from 'react';
import { Radio, Cpu, X } from 'lucide-react';
import { formatDateTime } from '@/lib/datetime';

interface SessionData {
  sessionId: string;
  username: string;
  host: string;
  startedAt: Date;
  connectionId: string;
  protocol: string;
  userId: string;
}

export default function ActiveSessionsWidget({ userId }: { userId: string }) {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to poll sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTerminate = async (sessionId: string) => {
    if (!confirm('Terminate this active session? Your terminal connection will be closed.')) return;
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSessions();
      }
    } catch (err) {
      console.error('Failed to terminate session:', err);
    }
  };

  if (loading && sessions.length === 0) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Radio size={18} style={{ color: 'var(--success)' }} />
          <span>Your Active Sessions</span>
        </h3>
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          Loading sessions...
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Radio size={18} style={{ color: sessions.length > 0 ? 'var(--success)' : 'var(--text-muted)' }} />
        <span>Your Active Sessions</span>
        <span className="badge" style={{ fontSize: '0.7rem', backgroundColor: sessions.length > 0 ? 'rgba(80, 250, 123, 0.1)' : 'var(--bg-tertiary)', color: sessions.length > 0 ? 'var(--success)' : 'var(--text-muted)', marginLeft: '0.5rem' }}>
          {sessions.length}
        </span>
      </h3>

      {sessions.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1.5rem',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--border-radius)',
          color: 'var(--text-muted)',
          fontSize: '0.9rem'
        }}>
          <Cpu size={32} style={{ color: 'var(--border)', marginBottom: '0.5rem' }} />
          <p>No active sessions currently running.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Session ID</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Remote Host</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Protocol</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Start Time</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((sess) => (
                <tr key={sess.sessionId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--terminal-font)', fontSize: '0.8rem', color: 'var(--accent)' }}>
                    {sess.sessionId}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--terminal-font)', fontSize: '0.8rem' }}>
                    {sess.host}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className="badge" style={{ fontSize: '0.7rem', backgroundColor: sess.protocol === 'VNC' ? 'rgba(139, 233, 253, 0.1)' : 'rgba(189, 147, 249, 0.1)', color: sess.protocol === 'VNC' ? 'var(--info)' : 'var(--accent)' }}>
                      {sess.protocol}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                    {formatDateTime(sess.startedAt, { dateFormat: 'EU' })}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleTerminate(sess.sessionId)}
                      title="Terminate this session"
                      style={{ padding: '0.15rem 0.4rem' }}
                    >
                      <X size={14} />
                      <span style={{ fontSize: '0.7rem' }}>Kill</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
