'use client';

import React, { useEffect, useState } from 'react';
import { Server, Monitor, Cpu, Activity, Box } from 'lucide-react';

interface PveSummary {
  enabled: boolean;
  connected: boolean;
  nodeCount: number;
  onlineNodes: number;
  vmCount: number;
  runningVms: number;
}

interface SystemsSummary {
  enabled: boolean;
  total: number;
  online: number;
  osGroups: { os: string; count: number }[];
}

export default function PluginStats() {
  const [pve, setPve] = useState<PveSummary | null>(null);
  const [systems, setSystems] = useState<SystemsSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      const [pveRes, sysRes] = await Promise.all([
        fetch('/api/plugins/proxmox').then(r => r.json()).catch(() => null),
        fetch('/api/systems').then(r => r.json()).catch(() => null),
      ]);

      if (cancelled) return;

      if (pveRes) {
        if (pveRes.ok && pveRes.data) {
          const nodes = pveRes.data.nodes || [];
          const resources = pveRes.data.resources || [];
          setPve({
            enabled: true,
            connected: pveRes.connected,
            nodeCount: nodes.length,
            onlineNodes: nodes.filter((n: any) => n.status === 'online').length,
            vmCount: resources.length,
            runningVms: resources.filter((r: any) => r.status === 'running').length,
          });
        } else if (!pveRes.ok || pveRes.error) {
          setPve({ enabled: false, connected: false, nodeCount: 0, onlineNodes: 0, vmCount: 0, runningVms: 0 });
        }
      }

      if (sysRes && sysRes.ok && sysRes.systems) {
        const sysList = sysRes.systems;
        const groups: Record<string, number> = {};
        sysList.forEach((s: any) => {
          const os = s.prettyName || s.osName || 'Unknown';
          groups[os] = (groups[os] || 0) + 1;
        });
        setSystems({
          enabled: true,
          total: sysList.length,
          online: sysList.filter((s: any) => s.status === 'online').length,
          osGroups: Object.entries(groups)
            .map(([os, count]) => ({ os, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5),
        });
      } else {
        setSystems({ enabled: false, total: 0, online: 0, osGroups: [] });
      }

      setLoaded(true);
    };

    fetchStats();
    return () => { cancelled = true; };
  }, []);

  if (!loaded) return null;

  const pveActive = pve?.enabled;
  const sysActive = systems?.enabled;

  if (!pveActive && !sysActive) return null;

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: (pveActive && sysActive) ? '1fr 1fr' : '1fr',
    gap: '1.5rem',
  };

  return (
    <div style={gridStyle}>
      {pveActive && pve && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={18} style={{ color: 'var(--accent)' }} />
            <span>Proxmox VE</span>
            {!pve.connected && (
              <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>Disconnected</span>
            )}
          </h3>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <StatTile icon={<Activity size={18} />} bgColor="rgba(80, 250, 123, 0.1)" accent="var(--success)" label="Online Nodes" value={`${pve.onlineNodes} / ${pve.nodeCount}`} />
            <StatTile icon={<Box size={18} />} bgColor="rgba(139, 233, 253, 0.1)" accent="var(--info)" label="VMs & Containers" value={`${pve.vmCount}`} />
            <StatTile icon={<Cpu size={18} />} bgColor="rgba(189, 147, 249, 0.1)" accent="var(--accent)" label="Running" value={`${pve.runningVms} / ${pve.vmCount}`} />
          </div>
        </div>
      )}

      {sysActive && systems && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Monitor size={18} style={{ color: 'var(--success)' }} />
            <span>Systems</span>
          </h3>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <StatTile icon={<Cpu size={18} />} bgColor="rgba(80, 250, 123, 0.1)" accent="var(--success)" label="Online" value={`${systems.online} / ${systems.total}`} />
            {systems.osGroups.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  OS Breakdown
                </span>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {systems.osGroups.map((g) => (
                    <span
                      key={g.os}
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {g.os} &times;{g.count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ icon, bgColor, accent, label, value }: { icon: React.ReactNode; bgColor: string; accent: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{
        backgroundColor: bgColor,
        padding: '0.4rem',
        borderRadius: '50%',
        display: 'flex',
        color: accent,
      }}>
        {icon}
      </div>
      <div>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
          {label}
        </span>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {value}
        </span>
      </div>
    </div>
  );
}
