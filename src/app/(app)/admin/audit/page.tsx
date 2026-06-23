import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import AuditLogsViewer from './AuditLogsViewer';

export default async function AdminAuditPage() {
  // 1. Resolve session and enforce strict ADMIN role check (Security mandate #4)
  const session = await auth();
  if (!session || !session.user) {
    redirect('/login');
  }

  const role = (session.user as any).role;
  if (role !== 'ADMIN') {
    redirect('/dashboard?error=forbidden');
  }

  const limit = 25;

  // 2. Fetch the first page of audit logs in parallel (Logs + Total Count)
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            username: true,
            name: true,
          },
        },
      },
    }),
    db.auditLog.count(),
  ]);

  // 3. Serialize models cleanly for client-side passing
  const serializedLogs = logs.map((log: any) => ({
    id: log.id,
    userId: log.userId,
    event: log.event,
    ip: log.ip,
    meta: log.meta,
    createdAt: log.createdAt.toISOString(),
    user: log.user ? {
      name: log.user.name,
      email: log.user.email,
      username: log.user.username,
    } : null,
  }));

  return (
    <AuditLogsViewer
      initialLogs={serializedLogs}
      total={total}
      limit={limit}
    />
  );
}
