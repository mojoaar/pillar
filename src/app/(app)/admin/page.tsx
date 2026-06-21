import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminDashboard from './AdminDashboard';

export default async function AdminDashboardPage() {
  // Redundant server-side auth and role scope guards (Security mandate #4)
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  const role = (session.user as any).role;
  if (role !== 'ADMIN') {
    redirect('/dashboard?error=forbidden');
  }

  return <AdminDashboard />;
}
