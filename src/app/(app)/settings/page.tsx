import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import SettingsTabs from './SettingsTabs';

export default async function SettingsPage() {
  // 1. Resolve session on the server
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  // 2. Fetch fresh user records from database
  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    redirect('/login');
  }

  const serializedUser = {
    id: user.id,
    name: user.name || 'User',
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    mfaEnabled: user.mfaEnabled,
  };

  return <SettingsTabs user={serializedUser} />;
}
