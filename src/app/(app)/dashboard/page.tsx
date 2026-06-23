import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Terminal, Plus, ArrowRight, ShieldCheck, HeartPulse, History } from 'lucide-react';
import { formatDateTime } from '@/lib/datetime';
import ActiveSessionsWidget from '@/components/layout/ActiveSessionsWidget';

export default async function DashboardPage() {
  // Resolve user session on the server (Security mandate #3)
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  // Load owned and shared connection counts in parallel
  const [ownedCount, sharedCount, connections, recentLogs] = await Promise.all([
    db.connection.count({ where: { userId: session.user.id } }),
    db.sharedConnection.count({ where: { userId: session.user.id } }),
    db.connection.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          { sharedWith: { some: { userId: session.user.id } } }
        ]
      },
      take: 5,
      orderBy: { createdAt: 'desc' }
    }),
    db.auditLog.findMany({
      where: { userId: session.user.id },
      take: 4,
      orderBy: { createdAt: 'desc' }
    })
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Welcome Banner */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
          Welcome back, {session.user.name}!
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Monitor your saved connections and launch secure SSH or VNC bridges.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid-3">
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            backgroundColor: 'rgba(189, 147, 249, 0.1)',
            color: 'var(--accent)',
            padding: '0.75rem',
            borderRadius: '50%',
            display: 'flex'
          }}>
            <Terminal size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Your SSH Profiles
            </span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
              {ownedCount}
            </h3>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            backgroundColor: 'rgba(80, 250, 123, 0.1)',
            color: 'var(--success)',
            padding: '0.75rem',
            borderRadius: '50%',
            display: 'flex'
          }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Shared With Me
            </span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
              {sharedCount}
            </h3>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            backgroundColor: 'rgba(139, 233, 253, 0.1)',
            color: 'var(--info)',
            padding: '0.75rem',
            borderRadius: '50%',
            display: 'flex'
          }}>
            <HeartPulse size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Gateway Status
            </span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)', marginTop: '0.15rem' }}>
              Online
            </h3>
          </div>
        </div>
      </div>

      {/* Main Dashboard Workspace */}
      <div className="grid-2">
        {/* Quick Connect Catalog Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="flex-between">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Quick Connect Catalog</h3>
            <Link href="/connections" className="btn btn-secondary btn-sm">
              <Plus size={14} />
              <span>Add Connection</span>
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {connections.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2.5rem 1.5rem',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--border-radius)',
                color: 'var(--text-muted)',
                fontSize: '0.9rem'
              }}>
                <Terminal size={32} style={{ marginBottom: '0.5rem', color: 'var(--border)' }} />
                <p>No connections defined yet.</p>
                <Link href="/connections" style={{ color: 'var(--accent)', textDecoration: 'underline', marginTop: '0.5rem', display: 'inline-block' }}>
                  Create your first profile →
                </Link>
              </div>
            ) : (
              connections.map((conn) => (
                <div 
                  key={conn.id} 
                  className="flex-between"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--border-radius)',
                    padding: '0.75rem 1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {conn.protocol === 'VNC' ? (
                      <span style={{ color: 'var(--success)', display: 'flex', fontSize: '1.15rem' }}>📺</span>
                    ) : (
                      <Terminal size={18} style={{ color: 'var(--accent)' }} />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{conn.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--terminal-font)' }}>
                        {conn.username}@{conn.host}:{conn.port}
                        {conn.domain && <span style={{ color: 'var(--accent)', marginLeft: '0.5rem' }}>({conn.domain})</span>}
                      </span>
                    </div>
                  </div>
                  
                  <Link href={conn.protocol === 'VNC' ? `/connections/vnc/${conn.id}`  : `/connections/${conn.id}`} className="btn btn-primary btn-sm">
                    <span>Connect</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Security Audit Activity Feed */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="flex-between">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Recent Events</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-updating</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recentLogs.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '2.5rem 1.5rem',
                color: 'var(--text-muted)',
                fontSize: '0.9rem'
              }}>
                <History size={32} style={{ marginBottom: '0.5rem', color: 'var(--border)' }} />
                <p>No recent activity logs.</p>
              </div>
            ) : (
              recentLogs.map((log) => (
                <div 
                  key={log.id} 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: '0.75rem',
                  }}
                >
                  <div className="flex-between">
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {log.event}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {formatDateTime(log.createdAt, { dateFormat: 'EU' })}
                    </span>
                  </div>
                  <div className="flex-between" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>IP: {log.ip || 'Local/Internal'}</span>
                    {log.meta && (
                      <span style={{ fontFamily: 'var(--terminal-font)', color: 'var(--accent)' }}>
                        {JSON.parse(log.meta).name || ''}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <ActiveSessionsWidget userId={session.user.id as string} />
    </div>
  );
}
