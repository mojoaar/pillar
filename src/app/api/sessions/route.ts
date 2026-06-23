import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sessionRegistry } from '@/lib/sessions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id as string;
    const role = (session.user as any).role;

    const allSessions = sessionRegistry.getAll();

    // ADMIN sees all sessions; regular users see only their own
    const filtered = role === 'ADMIN'
      ? allSessions
      : allSessions.filter((s) => s.userId === userId);

    return NextResponse.json({ sessions: filtered, ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
