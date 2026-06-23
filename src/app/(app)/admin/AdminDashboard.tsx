'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, Radio, Activity, Cpu, Users, History, Play, X } from 'lucide-react';
import { formatDateTime } from '@/lib/datetime';

interface SessionData {
  sessionId: string;
  username: string;
  host: string;
  startedAt: string;
}

interface MetricsData {
  cpuLoad: number;
  freeMem: number;
  totalMem: number;
  uptime: number;
  activeSessions: number;
  sessions: SessionData[];
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/admin/metrics');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.data);
      }
    } catch (err) {
      console.error('Failed to poll admin metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // refresh metrics every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Helper to format memory sizes cleanly
  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const handleTerminate = async (sessionId: string) => {
    if (!confirm('Forcefully terminate this active WebSocket session? The user will be disconnected immediately.')) return;
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchMetrics(); // Refresh immediately
      }
    } catch (err) {
      console.error('Failed to terminate session:', err);
    }
  };

  const getUptimeString = (uptimeSeconds: number) => {
    const days = Math.floor(uptimeSeconds / (24 * 3600));
    const hours = Math.floor((uptimeSeconds % (24 * 3600)) / 3600);
    const mins = Math.floor((uptimeSeconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  if (loading && !metrics) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-secondary)' }}>
        Loading Admin Metrics Dashboard...
      </div>
    );
  }

  const cpu = metrics?.cpuLoad || 0;
  const totalM = metrics?.totalMem || 0;
  const freeM = metrics?.freeMem || 0;
  const usedM = totalM - freeM;
  const memPercent = totalM ? (usedM / totalM) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Admin Title & Bar Navigation */}
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield style={{ color: 'var(--danger)' }} />
            <span>Admin Control Panel</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Monitor real-time gateway resource loads, inspect active sockets, and audit user logins.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/admin/users" className="btn btn-secondary">
            <Users size={16} />
            <span>User Manager</span>
          </Link>
          <Link href="/admin/audit" className="btn btn-secondary">
            <History size={16} />
            <span>Audit Trail</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid-3">
        {/* CPU Usage Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="flex-between" style={{ color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>CPU Load Average</span>
            <Cpu size={18} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{cpu}%</h3>
            <span style={{ fontSize: '0.85rem', color: cpu > 70 ? 'var(--danger)' : 'var(--text-muted)' }}>
              {cpu > 70 ? 'Heavy Load' : 'Normal'}
            </span>
          </div>
          {/* Progress Bar (pure CSS) */}
          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(cpu * 100, 100)}%`, height: '100%', backgroundColor: cpu > 70 ? 'var(--danger)' : 'var(--accent)', transition: 'width 0.5s ease' }} />
          </div>
        </div>

        {/* Memory Allocation Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="flex-between" style={{ color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>RAM Allocation</span>
            <Activity size={18} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatBytes(usedM)}</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>of {formatBytes(totalM)}</span>
          </div>
          {/* Progress Bar */}
          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${memPercent}%`, height: '100%', backgroundColor: memPercent > 80 ? 'var(--danger)' : 'var(--success)', transition: 'width 0.5s ease' }} />
          </div>
        </div>

        {/* Host Uptime Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="flex-between" style={{ color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Server Uptime</span>
            <Radio size={18} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>
              {metrics ? getUptimeString(metrics.uptime) : '0d 0h 0m'}
            </h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pillar Service Status: Online</span>
        </div>
      </div>

      {/* Active Socket Sessions Panel */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Radio size={18} style={{ color: 'var(--success)' }} />
          <span>Active WebSocket SSH Tunnels</span>
        </h3>

        {!metrics || metrics.sessions.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 1.5rem',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--border-radius)',
            color: 'var(--text-muted)',
            fontSize: '0.9rem'
          }}>
            <Cpu size={32} style={{ color: 'var(--border)', marginBottom: '0.5rem' }} />
            <p>No active remote gateway sessions currently running.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Session ID</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Active User</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Remote Host Address</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Start Time (Local)</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {metrics.sessions.map((sess) => (
                  <tr key={sess.sessionId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--terminal-font)', fontSize: '0.8rem', color: 'var(--accent)' }}>
                      {sess.sessionId}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>
                      {sess.username}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--terminal-font)', fontSize: '0.8rem' }}>
                      {sess.host}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                      {formatDateTime(sess.startedAt, { dateFormat: 'EU' })}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleTerminate(sess.sessionId)}
                        title="Forcefully terminate this session"
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
    </div>
  );
}
