import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkUpdates, installUpdates, rebootSystem } from '@/lib/remote-exec';
import { writeAudit } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function verifyAccess(connectionId: string, userId: string): Promise<{ allowed: boolean; error?: NextResponse }> {
  const connection = await db.connection.findUnique({
    where: { id: connectionId },
    include: { sharedWith: true },
  });

  if (!connection) {
    return { allowed: false, error: NextResponse.json({ error: 'Connection not found' }, { status: 404 }) };
  }

  if (!connection.allowRemoteExec) {
    return { allowed: false, error: NextResponse.json({ error: 'Remote exec not enabled for this connection' }, { status: 403 }) };
  }

  const isOwner = connection.userId === userId;
  const isShared = connection.sharedWith.some((s: any) => s.userId === userId);
  if (!isOwner && !isShared) {
    return { allowed: false, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { allowed: true };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id as string;
    const access = await verifyAccess(id, userId);
    if (!access.allowed) return access.error!;

    const body = await request.json().catch(() => ({}));
    const { action } = body;
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');

    if (action === 'check-updates') {
      const result = await checkUpdates(id);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'install-updates') {
      await writeAudit(userId, 'System Updates Installed', ip, { connectionId: id, action });
      const result = await installUpdates(id);
      return NextResponse.json({ ok: result.success, stdout: result.stdout, stderr: result.stderr });
    }

    if (action === 'reboot') {
      await writeAudit(userId, 'System Reboot Initiated', ip, { connectionId: id, action });
      const result = await rebootSystem(id);
      return NextResponse.json({ ok: result.success, stdout: result.stdout, stderr: result.stderr });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('System action failed:', error.message);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
