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

  const sendKeyCombo = (keysyms: number[]) => {
    const client = clientRef.current;
    if (!client || status !== 'Connected') return;
    keysyms.forEach((k) => client.sendKeyEvent(1, k));
    [...keysyms].reverse().forEach((k) => client.sendKeyEvent(0, k));
  };

  useEffect(() => {
    let active = true;
    let client: any = null;

    const initializeGuacamole = () => {
      if (!active) return;
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
        client = new Guacamole.Client(tunnel);
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
          if (!active) return;
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
          if (!active) return;
          console.error('[Guacamole Client Error]', errorObj.message || errorObj);
          setError(`Gateway Handshake Error: ${errorObj.message || 'Connection refused.'}`);
        };

        // 6. Connect to remote host, passing our connection profile context
        client.connect(`connectionId=${connectionId}`);

        // 7. Establish Mouse & Keyboard streaming event listeners
        const mouse = new Guacamole.Mouse(displayElement);
        
        mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (mouseState: any) => {
          if (client) client.sendMouseState(mouseState);
        };

        const keyboard = new Guacamole.Keyboard(document);
        
        keyboard.onkeydown = (keysym: any) => {
          if (client) client.sendKeyEvent(1, keysym);
        };
        
        keyboard.onkeyup = (keysym: any) => {
          if (client) client.sendKeyEvent(0, keysym);
        };

      } catch (err: any) {
        console.error('[Guacamole] Boot crashed:', err);
        setError(`Failed to launch RDP gateway: ${err.message}`);
      }
    };

    const Guacamole = (window as any).Guacamole;
    if (Guacamole) {
      initializeGuacamole();
    } else {
      // Check if script is already appended
      let script = document.querySelector('script[src="/js/guacamole-common.min.js"]') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.src = '/js/guacamole-common.min.js';
        script.async = true;
        document.body.appendChild(script);
      }

      const onLoad = () => {
        initializeGuacamole();
      };

      const onError = () => {
        if (active) {
          setError('Failed to load Guacamole assets. Please refresh or verify server status.');
        }
      };

      script.addEventListener('load', onLoad);
      script.addEventListener('error', onError);

      return () => {
        active = false;
        if (client) {
          client.disconnect();
        }
        if (script) {
          script.removeEventListener('load', onLoad);
          script.removeEventListener('error', onError);
        }
      };
    }

    return () => {
      active = false;
      if (client) {
        client.disconnect();
      }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {error && <span style={{ color: 'var(--danger)', fontWeight: 600, marginRight: '1rem' }}>{error}</span>}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button
              onClick={() => sendKeyCombo([0xFFE3, 0xFFE9, 0xFFFF])}
              disabled={status !== 'Connected'}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.7rem',
                padding: '0.2rem 0.6rem',
                height: 'auto',
                minWidth: 'unset',
                textTransform: 'none',
                letterSpacing: 'normal',
                opacity: status === 'Connected' ? 1 : 0.5,
                cursor: status === 'Connected' ? 'pointer' : 'not-allowed'
              }}
              title="Send Ctrl+Alt+Delete (Secure Attention Sequence) to host"
            >
              Ctrl+Alt+Del
            </button>
            <button
              onClick={() => sendKeyCombo([0xFFEB])}
              disabled={status !== 'Connected'}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.7rem',
                padding: '0.2rem 0.6rem',
                height: 'auto',
                minWidth: 'unset',
                textTransform: 'none',
                letterSpacing: 'normal',
                opacity: status === 'Connected' ? 1 : 0.5,
                cursor: status === 'Connected' ? 'pointer' : 'not-allowed'
              }}
              title="Send Windows Logo key to host"
            >
              Win
            </button>
            <button
              onClick={() => sendKeyCombo([0xFF1B])}
              disabled={status !== 'Connected'}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.7rem',
                padding: '0.2rem 0.6rem',
                height: 'auto',
                minWidth: 'unset',
                textTransform: 'none',
                letterSpacing: 'normal',
                opacity: status === 'Connected' ? 1 : 0.5,
                cursor: status === 'Connected' ? 'pointer' : 'not-allowed'
              }}
              title="Send Escape key to host"
            >
              Esc
            </button>
          </div>
        </div>
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
