import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import SetupForm from './SetupForm';

export default async function SetupPage() {
  // Guard the setup wizard: redirect to login if any user has already been seeded
  const userCount = await db.user.count();
  if (userCount > 0) {
    redirect('/login');
  }

  return <SetupForm />;
}
