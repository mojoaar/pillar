'use client';

import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { useTheme } from '@/components/theme/ThemeProvider';
import '@xterm/xterm/css/xterm.css';

interface TerminalWindowProps {
  connectionId: string;
}

export default function TerminalWindow({ connectionId }: TerminalWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const { theme, font } = useTheme();

  // ==========================================
  // REAL-TIME TERMINAL RE-THEMING (Live Swapping)
  // ==========================================
  useEffect(() => {
    if (!termRef.current) return;

    // Read newly computed CSS variables on-the-fly from root layout
    const styles = getComputedStyle(document.documentElement);
    const bg = styles.getPropertyValue('--terminal-bg').trim() || '#1e1f29';
    const fg = styles.getPropertyValue('--terminal-text').trim() || '#f8f8f2';
    const cursor = styles.getPropertyValue('--terminal-cursor').trim() || '#ff79c6';
    const selection = styles.getPropertyValue('--terminal-selection').trim() || '#44475a';
    const fontFamily = styles.getPropertyValue('--terminal-font').trim() || 'monospace';

    // Hot-swap options on the running xterm.js instance instantly without page reload!
    termRef.current.options.theme = {
      background: bg,
      foreground: fg,
      cursor,
      selectionBackground: selection,
    };
    termRef.current.options.fontFamily = fontFamily;

    // Refit the terminal canvas smoothly
    setTimeout(() => {
      try {
        fitAddonRef.current?.fit();
      } catch (err) {}
    }, 50);
  }, [theme, font]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Read custom scrollback lines from browser preferences (Finding #scrollback)
    const savedScrollback = typeof window !== 'undefined' 
      ? parseInt(localStorage.getItem('pillar-scrollback') || '1000', 10) 
      : 1000;

    // Read computed CSS variables dynamically from Root node
    const styles = getComputedStyle(document.documentElement);
    const bg = styles.getPropertyValue('--terminal-bg').trim() || '#1e1f29';
    const fg = styles.getPropertyValue('--terminal-text').trim() || '#f8f8f2';
    const cursor = styles.getPropertyValue('--terminal-cursor').trim() || '#ff79c6';
    const selection = styles.getPropertyValue('--terminal-selection').trim() || '#44475a';
    const fontSize = parseInt(styles.getPropertyValue('--font-size-terminal').trim(), 10) || 14;
    const fontFamily = styles.getPropertyValue('--terminal-font').trim() || 'monospace';

    // 2. Instantiate Terminal with dynamic scrollback history limits (Finding #scrollback)
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily,
      fontSize,
      scrollback: savedScrollback, // Set customizable scrollback viewport history lines
      theme: {
        background: bg,
        foreground: fg,
        cursor,
        selectionBackground: selection,
      },
      allowProposedApi: true,
    });

    termRef.current = term;

    // 3. Attach FitAddon to handle responsive container stretching
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    // Open terminal inside mounting node
    term.open(containerRef.current);
    
    // Perform initial scaling stretch
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (err) {
        // Silently capture fit hiccups on initial render
      }
    }, 100);

    // 4. Establish self-healing WebSocket connection
    const isSocketClosed = { current: false };

    const connectSocket = () => {
      isSocketClosed.current = false;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const { cols, rows } = term;

      term.write('\r\n\x1b[32m[Pillar Gateway] Connecting to remote host...\x1b[0m\r\n');

      const socket = new WebSocket(
        `${protocol}//${wsHost}/api/ws/terminal?connectionId=${connectionId}&cols=${cols}&rows=${rows}`
      );

      socketRef.current = socket;
      socket.binaryType = 'arraybuffer';

      // Connect up Duplex pipeline streams
      socket.onopen = () => {
        term.write('\r\n\x1b[32m[Pillar Gateway] Connection established! Resuming session...\x1b[0m\r\n\r\n');
      };

      socket.onmessage = (event) => {
        // Write raw host stdout back to xterm viewport
        if (typeof event.data === 'string') {
          term.write(event.data);
        } else {
          term.write(new Uint8Array(event.data));
        }
      };

      socket.onerror = (err) => {
        if (!isSocketClosed.current) {
          console.error('[Terminal-WS] Connection socket errored.');
        }
      };

      // Read details close reasons sent from gateway on handshakes failure (Finding #onerror)
      socket.onclose = (event) => {
        const reason = event.reason || 'Remote node disconnected';
        const code = event.code;
        isSocketClosed.current = true;
        term.write(`\r\n\x1b[31m[Pillar Gateway Error] Sockets closed (Code ${code}): ${reason}\x1b[0m\r\n`);
        term.write('\r\n\x1b[33m[Pillar Gateway] Press ANY key to attempt reconnection...\x1b[0m\r\n');
      };
    };

    // Instantiate initial connection
    connectSocket();

    // Stream keystrokes from browser to remote server & trigger reconnects on close (Finding #self-heal)
    const onDataDisposable = term.onData((data) => {
      if (isSocketClosed.current) {
        connectSocket();
      } else if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(data);
      }
    });

    // ==========================================
    // PREMIUM COPY/PASTE INTERACTIVITY ENGINE (Finding #copypaste)
    // ==========================================
    
    // A. Copy on Selection (Highlighting text automatically copies it to local system clipboard)
    term.onSelectionChange(() => {
      if (term.hasSelection()) {
        const text = term.getSelection();
        navigator.clipboard.writeText(text).catch(() => {});
      }
    });

    // B. Intercept Keyboard Paste Shortcuts (Cmd+V on macOS, Ctrl+V on Windows/Linux)
    term.attachCustomKeyEventHandler((e) => {
      const isPaste = (e.metaKey || e.ctrlKey) && e.code === 'KeyV';
      if (isPaste && e.type === 'keydown') {
        navigator.clipboard.readText().then((text) => {
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(text);
          }
        }).catch((err) => {
          console.warn('[Terminal-Clipboard] Failed to read from system clipboard:', err);
        });
        return false; // Prevent default xterm handling of V keystroke
      }
      return true;
    });

    // C. Capture standard browser Context Paste operations on the container element
    const handlePasteEvent = (e: ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text') || '';
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(text);
      }
    };

    containerRef.current.addEventListener('paste', handlePasteEvent);

    // 6. Responsive Resize Observer to notify SSH shell of layout updates
    const resizeObserver = new ResizeObserver(() => {
      try {
        if (fitAddonRef.current && termRef.current) {
          fitAddonRef.current.fit();
          const { cols, rows } = termRef.current;
          
          // Send resize control packet to server
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
          }
        }
      } catch (err) {
        // Silently skip observer glitches
      }
    });

    resizeObserver.observe(containerRef.current);

    // Keyboard focus lock
    term.focus();

    // 7. Cleanup pipelines and sockets on unmount
    return () => {
      resizeObserver.disconnect();
      if (containerRef.current) {
        containerRef.current.removeEventListener('paste', handlePasteEvent);
      }
      onDataDisposable.dispose();
      if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
        socketRef.current.close();
      }
      term.dispose();
    };
  }, [connectionId]);

  return (
    <div 
      ref={containerRef} 
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'var(--terminal-bg, #1e1f29)',
        padding: '0.5rem',
        borderRadius: 'var(--border-radius)',
        boxShadow: 'inset 0 2px 8px var(--shadow)',
        position: 'relative',
        overflow: 'hidden'
      }}
    />
  );
}
