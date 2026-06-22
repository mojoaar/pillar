'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Monitor, RefreshCw, Activity, Server, AlertTriangle, Plus, X, CheckCircle } from 'lucide-react';

interface ProxmoxResource {
  id: string;
  name: string;
  type: 'node' | 'qemu' | 'lxc';
  node: string;
  vmid?: number;
  status: string; // 'running', 'stopped', etc.
  os?: string;
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  uptime?: number;
}

interface NodeResource {
  node: string;
  status: string;
  ip?: string;
  os?: string;
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
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Overlay Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [protocol, setProtocol] = useState<'SSH' | 'VNC'>('SSH');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<'PASSWORD' | 'KEY'>('PASSWORD');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [tags, setTags] = useState('proxmox');
  const [ignoreCert, setIgnoreCert] = useState(true);
const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
        setVms((data.data.resources || []).filter((r: any) => r.type === 'qemu' || r.type === 'lxc'));
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

  const handleOpenImportModal = (vm: ProxmoxResource) => {
    setName(vm.name);
    setHost((vm as any).network || '');
    setProtocol('SSH');
    setPort(22);
    setUsername('root');
    setAuthType('PASSWORD');
    setPassword('');
    setPrivateKey('');
    setPassphrase('');
    setTags('proxmox');
    setIgnoreCert(true);
setSaveError(null);
    setSaveSuccess(false);
    setIsModalOpen(true);
  };

  const handleOpenNodeImportModal = (node: NodeResource) => {
    setName(node.node);
    setHost(node.ip || '');
    setProtocol('SSH');
    setPort(22);
    setUsername('root');
    setAuthType('PASSWORD');
    setPassword('');
    setPrivateKey('');
    setPassphrase('');
    setTags('proxmox,hypervisor');
    setIgnoreCert(true);
setSaveError(null);
    setSaveSuccess(false);
    setIsModalOpen(true);
  };

  const handleProtocolChange = (p: 'SSH' | 'VNC') => {
    setProtocol(p);
    if (p === 'SSH') setPort(22);
    else if (p === 'VNC') setPort(5900);
    
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          host,
          port,
          protocol,
          tags,
          ignoreCert,
          username,
          authType,
          password: password || null,
          privateKey: privateKey || null,
          passphrase: passphrase || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save connection.');

      setSaveSuccess(true);
      setTimeout(() => {
        setIsModalOpen(false);
        setSaveSuccess(false);
      }, 1500);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to import connection.');
    } finally {
      setSaveLoading(false);
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
            <span>Proxmox VE Cluster Inventory</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            Monitor cluster health, view hypervisor node states, and easily add VMs or containers to your connections catalog.
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
              const memUsage = node.mem && node.maxmem ? (node.mem / node.maxmem * 100).toFixed(1) : '0.0';
              
              return (
                <div key={node.node} className="card" style={{
                  display: 'flex', flexDirection: 'column', gap: '0.75rem',
                  cursor: 'pointer',
                  borderColor: selectedNode === node.node ? 'var(--accent)' : 'var(--border)',
                }} onClick={() => setSelectedNode(selectedNode === node.node ? null : node.node)}>
                  <div className="flex-between">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Activity size={18} style={{ color: node.status === 'online' ? 'var(--success)' : 'var(--danger)' }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ fontSize: '1.05rem' }}>{node.node}</strong>
                        {node.os && <span style={{ fontSize: '0.65rem', color: 'var(--accent)' }}>{node.os}</span>}
                        {node.ip && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--terminal-font)' }}>{node.ip}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                      <span className={`badge ${node.status === 'online' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                        {node.status}
                      </span>
                    </div>
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

                  {/* Connection Import Action for Host */}
                  <div style={{
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border)',
                    marginTop: 'auto'
                  }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent toggling selection filter
                        handleOpenNodeImportModal(node);
                      }}
                      style={{ width: '100%', justifyContent: 'center', gap: '0.4rem', padding: '0.35rem 0.5rem' }}
                    >
                      <Plus size={14} />
                      <span style={{ fontSize: '0.8rem' }}>Add to Connections</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* VMs / LXC Grid */}
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Virtual Machines & Containers{selectedNode ? ` — ${selectedNode}` : ''}</span>
            {selectedNode && (
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedNode(null)}>
                Show All
              </button>
            )}
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.25rem'
          }}>
            {vms
              .filter((vm) => !selectedNode || vm.node === selectedNode)
              .map((vm) => {
              const isRunning = vm.status === 'running';
              const cpuUsage = vm.cpu && vm.maxcpu ? (vm.cpu * 100).toFixed(1) : '0.0';
              const memUsage = vm.mem && vm.maxmem ? (vm.mem / vm.maxmem * 100).toFixed(1) : '0.0';
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
                        {vm.os && <span style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>{vm.os}</span>}
                        {(vm as any).network && <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontFamily: 'var(--terminal-font)' }}>{(vm as any).network}</span>}
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

                  {/* Connection Import Action — hidden for Windows VMs */}
                  {(!vm.os || !vm.os.toLowerCase().includes('windows')) && (
                  <div style={{
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border)',
                    marginTop: 'auto'
                  }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenImportModal(vm)}
                      style={{ width: '100%', justifyContent: 'center', gap: '0.4rem', padding: '0.35rem 0.5rem' }}
                    >
                      <Plus size={14} />
                      <span style={{ fontSize: '0.8rem' }}>Add to Connections</span>
                    </button>
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Import to Connections Dialog Overlay */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--border-radius)',
            width: '100%',
            maxWidth: '540px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={18} style={{ color: 'var(--accent)' }} />
                <span>Add VM to Connections</span>
              </h3>
              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={() => setIsModalOpen(false)}
                style={{ padding: '0.25rem', borderRadius: '50%', minWidth: 'unset', width: '28px', height: '28px', justifyContent: 'center', alignItems: 'center' }}
              >
                <X size={14} />
              </button>
            </div>

            {saveSuccess ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0', gap: '1rem' }}>
                <CheckCircle size={48} style={{ color: 'var(--success)' }} />
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Connection Saved Successfully!</h4>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  The profile has been added to your catalog.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveConnection} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {saveError && (
                  <div style={{ backgroundColor: 'rgba(255, 85, 85, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--border-radius)', fontSize: '0.85rem' }}>
                    {saveError}
                  </div>
                )}

                <div className="form-group">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Display Name</label>
                  <input
                    type="text"
                    className="input-field"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={saveLoading}
                    placeholder="e.g. Ubuntu VM"
                  />
                </div>

                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Protocol</label>
                    <select
                      className="input-field"
                      value={protocol}
                      onChange={(e) => handleProtocolChange(e.target.value as any)}
                      disabled={saveLoading}
                      style={{ width: '100%', height: '38px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--border-radius)', color: 'var(--text-primary)', padding: '0 0.5rem' }}
                    >
                      <option value="SSH">SSH</option>
                      <option value="VNC">VNC</option>
                      
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Port</label>
                    <input
                      type="number"
                      className="input-field"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      required
                      disabled={saveLoading}
                    />
                  </div>
                </div>

                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Host / IP Address</label>
                    <input
                      type="text"
                      className="input-field"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      required
                      disabled={saveLoading}
                      placeholder="e.g. 192.168.1.50"
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Username</label>
                    <input
                      type="text"
                      className="input-field"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      disabled={saveLoading}
                      placeholder="e.g. root"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Tags <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Comma-separated)</span></label>
                  <input
                    type="text"
                    className="input-field"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    disabled={saveLoading}
                  />
                </div>

                {protocol === 'SSH' && (
                  <div className="form-group">
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Authentication Handler</label>
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input
                          type="radio"
                          name="import-authType"
                          checked={authType === 'PASSWORD'}
                          onChange={() => setAuthType('PASSWORD')}
                          disabled={saveLoading}
                        />
                        <span>Password</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                        <input
                          type="radio"
                          name="import-authType"
                          checked={authType === 'KEY'}
                          onChange={() => setAuthType('KEY')}
                          disabled={saveLoading}
                        />
                        <span>Private Key</span>
                      </label>
                    </div>
                  </div>
                )}

                 {authType === 'PASSWORD' || protocol !== 'SSH' ? (
                   <>
                     <div className="form-group">
                       <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Password <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional)</span></label>
                       <input
                         type="password"
                         name="import-pwd-field"
                         autoComplete="new-password"
                         className="input-field"
                         value={password}
                         onChange={(e) => setPassword(e.target.value)}
                         disabled={saveLoading}
                         placeholder="••••••••"
                       />
                     </div>
                     
                   </>
                 ) : (
                  <>
                    <div className="form-group">
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Private Key <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional)</span></label>
                      <textarea
                        className="input-field"
                        value={privateKey}
                        onChange={(e) => setPrivateKey(e.target.value)}
                        disabled={saveLoading}
                        rows={4}
                        placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                        style={{ fontFamily: 'var(--terminal-font)', fontSize: '0.8rem', resize: 'vertical' }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Key Passphrase <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional)</span></label>
                      <input
                        type="password"
                        className="input-field"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        disabled={saveLoading}
                        placeholder="••••••••"
                      />
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={saveLoading}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saveLoading}>
                    {saveLoading ? 'Saving...' : 'Save Connection'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
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
