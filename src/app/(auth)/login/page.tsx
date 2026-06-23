import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // If the database has 0 users, auto-redirect visitors to the interactive setup page
  const userCount = await db.user.count();
  if (userCount === 0) {
    redirect('/setup');
  }

  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}>
        Loading Login Portal...
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
