import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/admin/sessions/[id]
 * Forcefully terminates an active WebSocket SSH / VNC connection tunnel.
 * Restricted to users with the ADMIN role (Security mandate #4).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 1. Resolve session and enforce strict ADMIN role check (Security mandate #4)
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Administrative scope required.' }, { status: 403 });
    }

    // 2. Invoke the global session termination hook exposed by the Express ws server (Finding #terminate)
    const terminateSession = (globalThis as any).terminateSession;
    if (!terminateSession) {
      return NextResponse.json({ error: 'Session gateway termination handler not initialized.' }, { status: 500 });
    }

    const success = terminateSession(id);
    if (!success) {
      return NextResponse.json({ error: 'Active session not found or already closed.' }, { status: 404 });
    }

    // 3. Write event to system audit logs
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(
      session.user.id as string,
      'SSH Session Force Terminated',
      ip,
      { sessionId: id, message: 'Administrator initiated force closure of active terminal tunnel.' }
    );

    return NextResponse.json({ ok: true, message: 'Active session terminated successfully.' });

  } catch (error: any) {
    console.error('Failed to terminate session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
