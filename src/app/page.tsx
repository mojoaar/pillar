import Link from 'next/link';

export default function EntryPage() {
  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      width: '100vw',
      padding: '2rem',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      textAlign: 'center'
    }}>
      <div className="card" style={{ maxWidth: '480px', width: '100%' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--accent)' }}>PILLAR</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
          The bedrock of your home network. Secure browser-based remote-access gateway.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link href="/login" className="btn btn-primary">
            Sign In
          </Link>
          <Link href="/setup" className="btn btn-secondary">
            Setup Wizard
          </Link>
        </div>
      </div>
    </main>
  );
}
