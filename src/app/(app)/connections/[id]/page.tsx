import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import Terminal from '@/components/terminal/Terminal';
import Link from 'next/link';
import { ArrowLeft, Maximize2, ShieldCheck, Terminal as TermIcon } from 'lucide-react';

interface TerminalPageProps {
  params: Promise<{ id: string }>;
}

export default async function ConnectionTerminalPage({ params }: TerminalPageProps) {
  // 1. Await Next.js 15+ promised parameters (Gotcha #1 / #26)
  const { id } = await params;

  // 2. Resolve server session
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  // 3. Load connection profile and verify BOLA security bounds (Security mandate #3)
  const connection = await db.connection.findUnique({
    where: { id },
    include: { sharedWith: true },
  });

  if (!connection) {
    notFound();
  }

  const isOwner = connection.userId === session.user!.id;
  const isShared = connection.sharedWith.some((s) => s.userId === session.user!.id);

  if (!isOwner && !isShared) {
    redirect('/dashboard?error=forbidden');
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 110px)', // minus sidebar paddings and header height
      width: '100%',
      gap: '1rem'
    }}>
      {/* Terminal Title Bar */}
      <div className="flex-between" style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--border-radius)',
        padding: '0.75rem 1.25rem'
      }}>
        <div className="flex-align-center">
          <Link href="/connections" className="btn btn-secondary btn-sm" title="Back to Connections catalog">
            <ArrowLeft size={16} />
            <span>Catalog</span>
          </Link>
          <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--border)', margin: '0 0.5rem' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="flex-align-center">
              <TermIcon size={16} style={{ color: 'var(--accent)' }} />
              <strong style={{ fontSize: '0.95rem' }}>{connection.name}</strong>
              {isShared && <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>Shared</span>}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--terminal-font)' }}>
              {connection.username}@{connection.host}:{connection.port}
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

      {/* Terminal Display Viewport */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Terminal connectionId={id} />
      </div>
    </div>
  );
}
