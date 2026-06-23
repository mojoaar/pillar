'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Server,
  RefreshCw,
  ArrowUpCircle,
  RotateCw,
  Terminal,
  Clock,
  Cpu,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import styles from './page.module.css';

interface SystemData {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  osType: string | null;
  pollIntervalMin: number;
  isOwner: boolean;
  osName: string;
  osVersion: string;
  prettyName: string;
  kernel: string;
  uptime: string;
  lastChecked: string;
  status: 'online' | 'error';
  error: string | null;
}

interface UpdateResult {
  packageCount: number;
  packageList: string[];
}

type RebootingState = { id: string; since: number } | null;

export default function SystemsPage() {
  const [systems, setSystems] = useState<SystemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rebootingId, setRebootingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'install-updates' | 'reboot' } | null>(null);
  const [updateResults, setUpdateResults] = useState<Record<string, UpdateResult>>({});
  const [rebooting, setRebooting] = useState<RebootingState>(null);
  const [actionOutput, setActionOutput] = useState<string | null>(null);

  const pollIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const fetchSystems = useCallback(async () => {
    try {
      const res = await fetch('/api/systems');
      const data = await res.json();
      if (!mounted.current) return;
      if (data.ok) {
        setSystems(data.systems);
        setError(null);
      } else {
        setError(data.error || 'Failed to load systems');
      }
    } catch (err: any) {
      if (mounted.current) setError(err.message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSystems();
  }, [fetchSystems]);

  // Auto-poll: set up intervals per system
  useEffect(() => {
    pollIntervals.current.forEach((t) => clearInterval(t));
    pollIntervals.current.clear();

    systems.forEach((sys) => {
      const minutes = sys.pollIntervalMin || 60;
      const ms = minutes * 60 * 1000;
      const timer = setInterval(fetchSystems, ms);
      pollIntervals.current.set(sys.id, timer);
    });

    return () => {
      pollIntervals.current.forEach((t) => clearInterval(t));
    };
  }, [systems, fetchSystems]);

  // Post-reboot tracking
  useEffect(() => {
    if (!rebooting) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/systems');
        const data = await res.json();
        if (!data.ok) return;
        const target = data.systems.find((s: SystemData) => s.id === rebooting.id);
        if (target && target.status === 'online') {
          setRebooting(null);
          setSystems(data.systems);
          setActionOutput('[Pillar] System is back online after reboot.');
        }
      } catch {}
    }, 10000);

    return () => clearInterval(interval);
  }, [rebooting]);

  const handleCheckUpdates = async (id: string) => {
    setCheckingId(id);
    try {
      const res = await fetch(`/api/systems/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-updates' }),
      });
      const data = await res.json();
      if (data.ok) {
        setUpdateResults((prev) => ({
          ...prev,
          [id]: { packageCount: data.packageCount, packageList: data.packageList },
        }));
      }
    } catch (err: any) {
      setActionOutput(`Error: ${err.message}`);
    } finally {
      setCheckingId(null);
    }
  };

  const handleInstallUpdates = async (id: string) => {
    setConfirmAction(null);
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/systems/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'install-updates' }),
      });
      const data = await res.json();
      setActionOutput(data.ok
        ? `Updates installed successfully.\n${data.stdout || ''}`
        : `Update failed:\n${data.stderr || data.stdout || 'Unknown error'}`);
      // Refresh systems after update
      await fetchSystems();
    } catch (err: any) {
      setActionOutput(`Error: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReboot = async (id: string) => {
    setConfirmAction(null);
    setRebootingId(id);
    try {
      const res = await fetch(`/api/systems/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reboot' }),
      });
      const data = await res.json();
      if (data.ok) {
        setRebooting({ id, since: Date.now() });
        setActionOutput('Reboot initiated. Waiting for system to come back online...');
      } else {
        setActionOutput(`Reboot failed: ${data.stderr || data.stdout || 'Unknown error'}`);
        setRebootingId(null);
      }
    } catch (err: any) {
      setActionOutput(`Error: ${err.message}`);
      setRebootingId(null);
    }
  };

  if (loading) {
    return (
      <div className={styles.center}>
        <Loader2 size={32} className={styles.spin} />
        <span>Scanning remote systems...</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Remote Systems</h1>
          <p className={styles.subtitle}>
            Monitor operating systems, uptime, and pending updates across your homelab.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchSystems} disabled={loading}>
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {actionOutput && (
        <div className={styles.outputBanner}>
          <button className={styles.closeOutput} onClick={() => setActionOutput(null)}>×</button>
          <pre className={styles.outputPre}>{actionOutput}</pre>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <div className={styles.overlay} onClick={() => setConfirmAction(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {confirmAction.action === 'install-updates' ? 'Install Updates' : 'Reboot System'}
            </h3>
            <p className={styles.modalText}>
              {confirmAction.action === 'install-updates'
                ? 'This will install all pending system updates on the remote server. This may take several minutes.'
                : 'This will reboot the remote system. All active connections to this server will be terminated.'}
            </p>
            <div className={styles.modalButtons}>
              <button className="btn btn-secondary" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button
                className={`btn ${confirmAction.action === 'reboot' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => {
                  if (confirmAction.action === 'install-updates') handleInstallUpdates(confirmAction.id);
                  else handleReboot(confirmAction.id);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Systems Grid */}
      {systems.length === 0 ? (
        <div className={styles.empty}>
          <Server size={48} strokeWidth={1} />
          <p>No systems available for remote management.</p>
          <p className={styles.emptyHint}>
            Enable "Remote Exec" on your SSH connection profiles to manage them here.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {systems.map((sys) => {
            const isRebooting = rebooting?.id === sys.id;
            const updates = updateResults[sys.id];
            const isBusy = checkingId === sys.id || updatingId === sys.id || rebootingId === sys.id || isRebooting;

            return (
              <div
                key={sys.id}
                className={`${styles.card} ${sys.status === 'error' ? styles.cardError : ''} ${isRebooting ? styles.cardRebooting : ''}`}
              >
                {/* Card Header */}
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>
                    <Server size={20} />
                    <span>{sys.name}</span>
                  </div>
                  <span className={`${styles.statusDot} ${sys.status === 'online' ? styles.statusOnline : styles.statusError}`} />
                </div>

                {/* System Info */}
                <div className={styles.cardBody}>
                  <div className={styles.infoRow}>
                    <Cpu size={14} />
                    <span className={styles.infoLabel}>OS</span>
                    <span className={styles.infoValue}>{sys.prettyName || `${sys.osName} ${sys.osVersion}`}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <Terminal size={14} />
                    <span className={styles.infoLabel}>Kernel</span>
                    <span className={styles.infoValue}>{sys.kernel}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <Clock size={14} />
                    <span className={styles.infoLabel}>Uptime</span>
                    <span className={styles.infoValue}>{sys.uptime}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <Server size={14} />
                    <span className={styles.infoLabel}>Host</span>
                    <span className={styles.infoValue}>{sys.host}:{sys.port}</span>
                  </div>

                  {/* Update Status */}
                  {updates && (
                    <div className={`${styles.updateBadge} ${updates.packageCount > 0 ? styles.updatePending : styles.updateClean}`}>
                      {updates.packageCount > 0 ? (
                        <>
                          <AlertTriangle size={14} />
                          <span>{updates.packageCount} package{updates.packageCount !== 1 ? 's' : ''} pending</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} />
                          <span>Up to date</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Error */}
                  {sys.error && (
                    <div className={styles.errorText}>
                      <XCircle size={14} />
                      <span>{sys.error}</span>
                    </div>
                  )}

                  {/* Rebooting State */}
                  {isRebooting && (
                    <div className={styles.rebootingBanner}>
                      <Loader2 size={16} className={styles.spin} />
                      <span>Rebooting... checking in a moment</span>
                    </div>
                  )}

                  {/* Last Checked */}
                  <div className={styles.lastChecked}>
                    Last checked: {new Date(sys.lastChecked).toLocaleTimeString()}
                  </div>
                </div>

                {/* Card Actions */}
                <div className={styles.cardActions}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCheckUpdates(sys.id)}
                    disabled={isBusy}
                  >
                    {checkingId === sys.id ? (
                      <Loader2 size={14} className={styles.spin} />
                    ) : (
                      <Package size={14} />
                    )}
                    <span>Check Updates</span>
                  </button>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setConfirmAction({ id: sys.id, action: 'install-updates' })}
                    disabled={isBusy || !updates || updates.packageCount === 0}
                  >
                    <ArrowUpCircle size={14} />
                    <span>Update</span>
                  </button>

                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setConfirmAction({ id: sys.id, action: 'reboot' })}
                    disabled={isBusy}
                  >
                    <RotateCw size={14} />
                    <span>Reboot</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
