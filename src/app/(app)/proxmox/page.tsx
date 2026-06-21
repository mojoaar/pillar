'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Monitor, RefreshCw, Power, Ban, Play, RefreshCw as RebootIcon, Activity, Server, AlertTriangle } from 'lucide-react';

interface ProxmoxResource {
  id: string;
  name: string;
  type: 'node' | 'qemu' | 'lxc';
  node: string;
  vmid?: number;
  status: string; // 'running', 'stopped', etc.
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  uptime?: number;
}

interface NodeResource {
  node: string;
  status: string;
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
}

export default function ProxmoxDashboard() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [nodes, setNodes] = useState<NodeResource[]>([]);
  const [vms, setVms] = useState<ProxmoxResource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/plugins/proxmox');
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to query Proxmox client.');
      
      setEnabled(data.enabled || false);
      setConnected(data.connected || false);
      
      if (data.enabled && data.connected && data.data) {
        setNodes(data.data.nodes || []);
        // Extract VMs (qemu) and Containers (lxc)
        setVms(data.data.resources || []);
      } else if (data.enabled && !data.connected) {
        setError(data.message || 'Could not establish connection to the remote Proxmox VE hypervisor.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while communicating with the gateway server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleVmAction = async (vm: ProxmoxResource, action: 'start' | 'stop' | 'shutdown' | 'reboot' | 'suspend') => {
    if (!vm.vmid) return;
    
    const key = `${vm.id}-${action}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    setError(null);

    try {
      const res = await fetch('/api/plugins/proxmox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: vm.node,
          vmid: vm.vmid,
          type: vm.type,
          action,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch command.');

      // Reload dataset to update statuses in real-time after 1 second delay (allowing host cluster to record states)
      setTimeout(fetchData, 1000);
    } catch (err: any) {
      setError(err.message || 'Operation failed.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds) return '0s';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // State: Plugin Disabled Overview
  if (!loading && !enabled) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)', gap: '1.5rem' }}>
        <span style={{ fontSize: '4rem' }}>🔌</span>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Proxmox VE Plugin is Inactive</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '440px', lineHeight: 1.5, margin: 0 }}>
          This system integration is disabled or not configured. Administrators can configure custom cluster tokens under <strong>Admin &rarr; Plugins</strong>.
        </p>
        <Link href="/connections" className="btn btn-secondary">
          Back to Connections Catalog
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Title block */}
      <div className="flex-between">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server style={{ color: 'var(--accent)' }} />
            <span>Proxmox VE Cluster Console</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            Monitor cluster health, view hypervisor node states, and dispatch power commands to VM instances.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Connection Errors */}
      {error && (
        <div style={{
          backgroundColor: 'rgba(255, 85, 85, 0.1)',
          border: '1px solid var(--danger)',
          color: 'var(--danger)',
          padding: '1rem',
          borderRadius: 'var(--border-radius)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          lineHeight: 1.5
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Hypervisor Connection Failed</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading && nodes.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--accent)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
      ) : (
        <>
          {/* Nodes Resource Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {nodes.map((node) => {
              const cpuUsage = node.cpu && node.maxcpu ? (node.cpu * 100).toFixed(1) : '0.0';
              const memUsage = node.mem && node.maxmem ? (node.mem * 100).toFixed(1) : '0.0';
              
              return (
                <div key={node.node} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="flex-between">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Activity size={18} style={{ color: node.status === 'online' ? 'var(--success)' : 'var(--danger)' }} />
                      <strong style={{ fontSize: '1.05rem' }}>{node.node}</strong>
                    </div>
                    <span className={`badge ${node.status === 'online' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                      {node.status}
                    </span>
                  </div>

                  {node.status === 'online' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <div>
                        <div className="flex-between" style={{ marginBottom: '0.15rem' }}>
                          <span>CPU Usage</span>
                          <strong>{cpuUsage}%</strong>
                        </div>
                        <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${cpuUsage}%`, height: '100%', backgroundColor: 'var(--accent)' }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex-between" style={{ marginBottom: '0.15rem' }}>
                          <span>Memory Usage</span>
                          <strong>{memUsage}% ({formatBytes(node.mem)} / {formatBytes(node.maxmem)})</strong>
                        </div>
                        <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${memUsage}%`, height: '100%', backgroundColor: 'var(--success)' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* VMs / LXC Grid */}
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginTop: '1rem' }}>
            Virtual Machines & Containers
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.25rem'
          }}>
            {vms.map((vm) => {
              const isRunning = vm.status === 'running';
              const cpuUsage = vm.cpu && vm.maxcpu ? (vm.cpu * 100).toFixed(1) : '0.0';
              const memUsage = vm.mem && vm.maxmem ? (vm.mem * 100).toFixed(1) : '0.0';
              const keyPrefix = `${vm.id}-`;

              return (
                <div key={vm.id} className="card" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  borderColor: isRunning ? 'var(--border)' : 'rgba(255, 255, 255, 0.05)',
                  opacity: isRunning ? 1 : 0.75
                }}>
                  <div className="flex-between">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Monitor size={18} style={{ color: isRunning ? 'var(--success)' : 'var(--text-muted)' }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{vm.name}</strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {vm.vmid} • Node: {vm.node}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <span className="badge" style={{ fontSize: '0.65rem', backgroundColor: 'var(--bg-tertiary)' }}>
                        {vm.type === 'qemu' ? 'QEMU' : 'LXC'}
                      </span>
                      <span className={`badge ${isRunning ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                        {vm.status}
                      </span>
                    </div>
                  </div>

                  {isRunning && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <div className="flex-between">
                        <span>CPU Load</span>
                        <strong>{cpuUsage}%</strong>
                      </div>
                      <div className="flex-between">
                        <span>Memory</span>
                        <strong>{formatBytes(vm.mem)} / {formatBytes(vm.maxmem)} ({memUsage}%)</strong>
                      </div>
                      <div className="flex-between">
                        <span>Uptime</span>
                        <strong>{formatUptime(vm.uptime)}</strong>
                      </div>
                    </div>
                  )}

                  {/* Power Management Toolbar */}
                  <div style={{
                    display: 'flex',
                    gap: '0.4rem',
                    justifyContent: 'flex-end',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border)',
                    marginTop: 'auto'
                  }}>
                    {isRunning ? (
                      <>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleVmAction(vm, 'reboot')}
                          disabled={actionLoading[keyPrefix + 'reboot']}
                          title="Reboot instance"
                          style={{ padding: '0.25rem 0.5rem' }}
                        >
                          <RebootIcon size={12} className={actionLoading[keyPrefix + 'reboot'] ? 'spin' : ''} />
                          <span style={{ fontSize: '0.75rem' }}>Reboot</span>
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleVmAction(vm, 'shutdown')}
                          disabled={actionLoading[keyPrefix + 'shutdown']}
                          title="Graceful shutdown"
                          style={{ padding: '0.25rem 0.5rem' }}
                        >
                          <Power size={12} className={actionLoading[keyPrefix + 'shutdown'] ? 'spin' : ''} />
                          <span style={{ fontSize: '0.75rem' }}>Stop</span>
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleVmAction(vm, 'start')}
                        disabled={actionLoading[keyPrefix + 'start']}
                        title="Power on instance"
                        style={{ padding: '0.25rem 0.5rem', width: '100px', justifyContent: 'center' }}
                      >
                        <Play size={12} className={actionLoading[keyPrefix + 'start'] ? 'spin' : ''} />
                        <span style={{ fontSize: '0.75rem' }}>Power On</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Keyframe Styling */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
