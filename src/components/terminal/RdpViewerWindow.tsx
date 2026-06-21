'use client';

import React, { useEffect, useRef, useState } from 'react';

interface RdpViewerWindowProps {
  connectionId: string;
}

export default function RdpViewerWindow({ connectionId }: RdpViewerWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Loading Guacamole Engine...');
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<any>(null);

  useEffect(() => {
    // 1. Dynamically load guacamole-common-js on-demand from local static directory
    const script = document.createElement('script');
    script.src = '/js/guacamole-common.min.js';
    script.async = true;
    
    script.onload = () => {
      if (!containerRef.current) return;
      
      const Guacamole = (window as any).Guacamole;
      if (!Guacamole) {
        setError('Failed to resolve Guacamole client specifications.');
        return;
      }

      setStatus('Establishing tunnel connection...');

      try {
        // 2. Instantiate WebSocket Tunnel pointing to our custom upgrade proxy
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const tunnelUrl = `${protocol}//${window.location.host}/api/ws/rdp`;
        const tunnel = new Guacamole.WebSocketTunnel(tunnelUrl);
        
        // 3. Instantiate Guacamole Client
        const client = new Guacamole.Client(tunnel);
        clientRef.current = client;

        // 4. Attach canvas display element to viewport container
        const displayElement = client.getDisplay().getElement();
        containerRef.current.innerHTML = ''; // Clear loading spinner
        containerRef.current.appendChild(displayElement);

        // Styling canvas display
        displayElement.style.maxWidth = '100%';
        displayElement.style.maxHeight = '100%';
        displayElement.style.objectFit = 'contain';

        // 5. Handle status states
        client.onstatechange = (state: number) => {
          switch (state) {
            case 0: setStatus('Idle'); break;
            case 1: setStatus('Connecting...'); break;
            case 2: setStatus('Handshaking...'); break;
            case 3: setStatus('Connected'); break;
            case 4: setStatus('Disconnecting...'); break;
            case 5: setStatus('Disconnected'); break;
          }
        };

        client.onerror = (errorObj: any) => {
          console.error('[Guacamole Client Error]', errorObj.message || errorObj);
          setError(`Gateway Handshake Error: ${errorObj.message || 'Connection refused.'}`);
        };

        // 6. Connect to remote host, passing our connection profile context
        client.connect(`connectionId=${connectionId}`);

        // 7. Establish Mouse & Keyboard streaming event listeners
        const mouse = new Guacamole.Mouse(displayElement);
        
        mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (mouseState: any) => {
          client.sendMouseState(mouseState);
        };

        const keyboard = new Guacamole.Keyboard(document);
        
        keyboard.onkeydown = (keysym: any) => {
          client.sendKeyEvent(1, keysym);
        };
        
        keyboard.onkeyup = (keysym: any) => {
          client.sendKeyEvent(0, keysym);
        };

      } catch (err: any) {
        console.error('[Guacamole] Boot crashed:', err);
        setError(`Failed to launch RDP gateway: ${err.message}`);
      }
    };

    script.onerror = () => {
      setError('Failed to load Guacamole assets. Please refresh or verify server status.');
    };

    document.body.appendChild(script);

    // 8. Cleanup and disconnect on unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
      document.body.removeChild(script);
    };
  }, [connectionId]);

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
      {/* RDP Status Bar */}
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

      {/* Target Canvas Container */}
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
          position: 'relative',
          padding: '1rem'
        }}
      >
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontFamily: 'var(--terminal-font)' }}>
          Loading Guacamole specs from CDN...
        </span>
      </div>
    </div>
  );
}
