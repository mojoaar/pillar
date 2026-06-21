'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PveVncViewer from '@/components/terminal/PveVncViewer';
import Link from 'next/link';
import { ArrowLeft, Monitor, ShieldCheck } from 'lucide-react';

function ConsoleContent() {
  const searchParams = useSearchParams();
  const node = searchParams.get('node');
  const vmidStr = searchParams.get('vmid');
  const type = (searchParams.get('type') || 'qemu') as 'qemu' | 'lxc';

  if (!node || !vmidStr) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>Invalid console parameters.</p>
          <Link href="/proxmox" className="btn btn-secondary btn-sm" style={{ marginTop: '1rem' }}>Back to Proxmox</Link>
        </div>
      </div>
    );
  }

  const vmid = parseInt(vmidStr, 10);
  if (isNaN(vmid)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>Invalid VM ID.</p>
          <Link href="/proxmox" className="btn btn-secondary btn-sm" style={{ marginTop: '1rem' }}>Back to Proxmox</Link>
        </div>
      </div>
    );
  }

  if (type !== 'qemu' && type !== 'lxc') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>Invalid resource type.</p>
          <Link href="/proxmox" className="btn btn-secondary btn-sm" style={{ marginTop: '1rem' }}>Back to Proxmox</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 110px)',
      width: '100%',
      gap: '1rem'
    }}>
      <div className="flex-between" style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--border-radius)',
        padding: '0.75rem 1.25rem'
      }}>
        <div className="flex-align-center">
          <Link href="/proxmox" className="btn btn-secondary btn-sm" title="Back to Proxmox Console">
            <ArrowLeft size={16} />
            <span>Back</span>
          </Link>
          <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--border)', margin: '0 0.5rem' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="flex-align-center">
              <Monitor size={16} style={{ color: 'var(--accent)' }} />
              <strong style={{ fontSize: '0.95rem' }}>Proxmox VM Console #{vmid}</strong>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--terminal-font)' }}>
              Node: {node} &bull; Type: {type.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex-align-center" style={{ gap: '0.75rem' }}>
          <div className="flex-align-center" style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>
            <ShieldCheck size={16} />
            <span>Encrypted Tunnel</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <PveVncViewer node={node} vmid={vmid} type={type} />
      </div>
    </div>
  );
}

export default function ProxmoxConsolePage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontFamily: 'var(--terminal-font)' }}>
        Loading console parameters...
      </div>
    }>
      <ConsoleContent />
    </Suspense>
  );
}
