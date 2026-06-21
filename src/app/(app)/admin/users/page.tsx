import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import UserManager from './UserManager';

export default async function AdminUsersPage() {
  // 1. Resolve session and enforce strict ADMIN role check (Security mandate #4)
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  const role = (session.user as any).role;
  if (role !== 'ADMIN') {
    redirect('/dashboard?error=forbidden');
  }

  // 2. Fetch registered accounts from SQLite
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // 3. Serialize models cleanly for client-side passing
  const serializedUsers = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    username: u.username,
    role: u.role,
    mfaEnabled: u.mfaEnabled,
    isSuspended: u.isSuspended,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <UserManager
      initialUsers={serializedUsers}
      currentUserId={session.user.id!}
    />
  );
}
