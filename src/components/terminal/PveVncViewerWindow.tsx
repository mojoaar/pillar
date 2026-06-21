'use client';

import React, { useEffect, useRef, useState } from 'react';
import RFB from '@novnc/novnc';

interface PveVncViewerWindowProps {
  node: string;
  vmid: number;
  type: 'qemu' | 'lxc';
}

export default function PveVncViewerWindow({ node, vmid, type }: PveVncViewerWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Loading Engine...');
  const [error, setError] = useState<string | null>(null);
  const rfbRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    setStatus('Connecting to Proxmox hypervisor...');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws/proxmox-vnc?node=${encodeURIComponent(node)}&vmid=${vmid}&type=${type}`;
      
      const rfb = new RFB(containerRef.current, wsUrl, {
        credentials: {},
        shared: true,
      });

      rfbRef.current = rfb;

      rfb.addEventListener('connect', () => { setStatus('Connected'); });
      rfb.addEventListener('disconnect', (e: any) => {
        setStatus('Disconnected');
        if (e.detail?.clean) {
          setError(null);
        } else {
          setError('Connection to Proxmox VM console dropped.');
        }
      });
      rfb.addEventListener('credentialsrequired', () => {});

    } catch (err: any) {
      setError(`Failed to launch console: ${err.message}`);
    }

    return () => {
      if (rfbRef.current) {
        try { rfbRef.current.disconnect(); } catch (e) {}
      }
    };
  }, [node, vmid, type]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      backgroundColor: '#0a0a0a',
      borderRadius: 'var(--border-radius)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <div style={{
        padding: '0.5rem 1rem',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        fontSize: '0.8rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: status === 'Connected' ? 'var(--success)' : 'var(--warning)'
          }} />
          <span>Status: <strong>{status}</strong></span>
        </span>
        {error && <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{error}</span>}
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.5rem'
        }}
      >
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontFamily: 'var(--terminal-font)' }}>
          Initializing noVNC display canvas...
        </span>
      </div>
    </div>
  );
}
