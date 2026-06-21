import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import styles from '@/components/layout/Layout.module.css';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve session on the server to prevent UI flickering (Security mandate #3)
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  // Query the user's fresh database profile to get their live avatar URL (Finding #avatar-sync)
  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  });

  const user = {
    name: session.user.name || 'User',
    email: session.user.email || '',
    username: (session.user as any).username || 'user',
    role: (session.user as any).role || 'USER',
    avatarUrl: dbUser?.avatarUrl || null,
  };

  return (
    <div className={styles.container}>
      {/* Sidebar Navigation */}
      <Sidebar user={user} />
      
      {/* Main content viewport */}
      <div className={styles.mainSection}>
        {/* Header toolbar */}
        <Header user={user} />
        
        {/* Content area */}
        <main className={styles.contentArea}>
          {children}
        </main>
      </div>
    </div>
  );
}
