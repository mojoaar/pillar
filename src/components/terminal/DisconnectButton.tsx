'use client';

import React from 'react';
import { LogOut } from 'lucide-react';

export default function DisconnectButton() {
  const handleDisconnect = () => {
    if (confirm('Are you sure you want to terminate this active terminal session? This will immediately disconnect your PTY stream on the server.')) {
      // Dispatch a custom event to notify TerminalWindow to close permanently
      window.dispatchEvent(new CustomEvent('terminate-terminal-session'));
    }
  };

  return (
    <button
      onClick={handleDisconnect}
      className="btn btn-danger btn-sm"
      title="Immediately terminate and close this connection session"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.4rem 0.75rem',
        borderRadius: 'var(--border-radius)',
        fontSize: '0.8rem',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      <LogOut size={14} />
      <span>Disconnect</span>
    </button>
  );
}
