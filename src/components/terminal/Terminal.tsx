'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import TerminalWindow with SSR disabled, preventing pre-rendering compile failures (Gotcha #41)
const TerminalWindow = dynamic(() => import('./TerminalWindow'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-secondary)',
      borderRadius: 'var(--border-radius)',
      border: '1px solid var(--border)',
      fontFamily: 'var(--terminal-font)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--accent)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <span>Initializing Safe Terminal Stream...</span>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
});

interface TerminalProps {
  connectionId: string;
}

export default function Terminal({ connectionId }: TerminalProps) {
  return <TerminalWindow connectionId={connectionId} />;
}
