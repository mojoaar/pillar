'use client';

import React, { useState, useEffect } from 'react';
import { History, Search, ArrowLeft, ArrowRight, Shield, RefreshCw } from 'lucide-react';
import { formatDateTime } from '@/lib/datetime';

interface AuditLogModel {
  id: string;
  userId: string | null;
  event: string;
  ip: string | null;
  meta: string | null;
  createdAt: string;
  user?: {
    name: string | null;
    email: string;
    username: string;
  } | null;
}

interface AuditLogsViewerProps {
  initialLogs: AuditLogModel[];
  total: number;
  limit: number;
}

export default function AuditLogsViewer({
  initialLogs,
  total: initialTotal,
  limit,
}: AuditLogsViewerProps) {
  const [logs, setLogs] = useState<AuditLogModel[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  
  // Filter Fields
  const [eventFilter, setEventFilter] = useState('');
  const [ipFilter, setIpFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLogs = async (targetPage: number) => {
    setLoading(true);
    try {
      const url = new URL('/api/admin/audit', window.location.origin);
      url.searchParams.set('page', targetPage.toString());
      url.searchParams.set('limit', limit.toString());
      
      if (eventFilter) url.searchParams.set('event', eventFilter);
      if (ipFilter) url.searchParams.set('ip', ipFilter);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
        setTotal(data.total || 0);
        setPage(targetPage);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1); // reset to page 1 on new search
  };

  const handleReset = () => {
    setEventFilter('');
    setIpFilter('');
    setTimeout(() => {
      // Fetch with cleared state
      const url = new URL('/api/admin/audit', window.location.origin);
      url.searchParams.set('page', '1');
      url.searchParams.set('limit', limit.toString());
      fetch('/api/admin/audit')
        .then((r) => r.json())
        .then((data) => {
          setLogs(data.data || []);
          setTotal(data.total || 0);
          setPage(1);
        });
    }, 50);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  // Render meta object nicely as key-value tags or strings
  const renderMetaDetails = (metaStr: string | null) => {
    if (!metaStr) return '-';
    try {
      const parsed = JSON.parse(metaStr);
      if (parsed.message) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span>{parsed.message}</span>
            {parsed.host && <code style={{ fontSize: '0.75rem', fontFamily: 'var(--terminal-font)', color: 'var(--accent)' }}>Target: {parsed.host}</code>}
            {parsed.actions && <code style={{ fontSize: '0.75rem', fontFamily: 'var(--terminal-font)', color: 'var(--warning)' }}>Actions: {parsed.actions.join(', ')}</code>}
          </div>
        );
      }
      return <code style={{ fontSize: '0.75rem', fontFamily: 'var(--terminal-font)' }}>{JSON.stringify(parsed)}</code>;
    } catch {
      return metaStr;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Title */}
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History style={{ color: 'var(--accent)' }} />
            <span>Gateway Security Audit Trail</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            A complete, permanent record of sign-ins, remote terminals launched, and administrative overrides.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchLogs(page)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
            <style jsx>{`
              :global(.spin) { animation: spin 1s linear infinite; }
              @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
          </button>
        </div>
      </div>

      {/* Filter search Form */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
            <label htmlFor="filter-event">Search Event Type</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                id="filter-event"
                className="input-field"
                placeholder="e.g. SSH Session"
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group" style={{ flex: 1, minWidth: '180px', marginBottom: 0 }}>
            <label htmlFor="filter-ip">IP Address Filter</label>
            <input
              type="text"
              id="filter-ip"
              className="input-field"
              placeholder="e.g. 192.168"
              value={ipFilter}
              onChange={(e) => setIpFilter(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button type="button" className="btn btn-secondary" onClick={handleReset} disabled={loading}>
              Clear
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              Filter logs
            </button>
          </div>
        </form>
      </div>

      {/* Audit Logs Table */}
      <div className="card" style={{ padding: '0.5rem 1.5rem 1.5rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>Timestamp (Local)</th>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>Origin IP</th>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>Target User</th>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>System Event</th>
                <th style={{ padding: '1rem 0.5rem', fontWeight: 600 }}>Action Metadata Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No audit records match the selected filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* Timestamp */}
                    <td style={{ padding: '1rem 0.5rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {formatDateTime(log.createdAt, { dateFormat: 'EU' })}
                    </td>

                    {/* Origin IP */}
                    <td style={{ padding: '1rem 0.5rem', fontFamily: 'var(--terminal-font)', fontSize: '0.8rem' }}>
                      {log.ip || 'Local/Internal'}
                    </td>

                    {/* Active User */}
                    <td style={{ padding: '1rem 0.5rem' }}>
                      {log.user ? (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.user.name || log.user.username}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.user.email}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>System / Anonymous</span>
                      )}
                    </td>

                    {/* System Event name */}
                    <td style={{ padding: '1rem 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {log.event}
                    </td>

                    {/* Meta Object details */}
                    <td style={{ padding: '1rem 0.5rem', color: 'var(--text-secondary)' }}>
                      {renderMetaDetails(log.meta)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex-between" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total logs)
            </span>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => fetchLogs(page - 1)}
                disabled={page <= 1 || loading}
              >
                <ArrowLeft size={14} />
                <span>Prev</span>
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => fetchLogs(page + 1)}
                disabled={page >= totalPages || loading}
              >
                <span>Next</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
