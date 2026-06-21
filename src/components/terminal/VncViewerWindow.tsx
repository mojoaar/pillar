'use client';

import React, { useEffect, useRef, useState } from 'react';
import RFB from '@novnc/novnc';

interface VncViewerWindowProps {
  connectionId: string;
}

export default function VncViewerWindow({ connectionId }: VncViewerWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<RFB | null>(null);
  const [status, setStatus] = useState('Connecting to gateway...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Establish websocket endpoint URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/vnc?connectionId=${connectionId}`;

    setStatus('Handshaking with VNC Host...');

    try {
      // 2. Instantiate noVNC RFB viewer client
      const rfb = new RFB(containerRef.current, wsUrl, {
        shared: true,
        credentials: {}, // passwords, if requested, are handled inside standard VNC auth packets
      });

      rfbRef.current = rfb;

      // 3. Bind status and disconnect hooks
      rfb.addEventListener('connect', () => {
        setStatus('Connected');
        console.log('[noVNC] Connection established.');
      });

      rfb.addEventListener('disconnect', (e: any) => {
        setStatus('Disconnected');
        if (e.detail && e.detail.clean === false) {
          setError('VNC Stream terminated unexpectedly.');
        }
      });

      rfb.addEventListener('credentialsrequired', () => {
        // Prompts client natively if password-encrypted VNC server
        const password = prompt('Enter VNC Server Password:');
        if (password) {
          rfb.sendCredentials({ password });
        }
      });

      // 4. Cleanup on unmount
      return () => {
        if (rfbRef.current) {
          rfbRef.current.disconnect();
        }
      };

    } catch (err: any) {
      console.error('[noVNC] Launch failed:', err);
      setError(`Failed to load VNC viewer: ${err.message}`);
    }
  }, [connectionId]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      backgroundColor: '#050505',
      borderRadius: 'var(--border-radius)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* VNC Status Bar */}
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

      {/* Target Canvas Div Container required by noVNC */}
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
          position: 'relative'
        }}
      />
    </div>
  );
}
