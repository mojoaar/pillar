import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import os from 'os';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/metrics
 * Returns host metrics and counts of active SSH tunnels.
 * Restricted to users with the ADMIN role (Security mandate #4).
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Resolve session and enforce strict ADMIN role check (Security mandate #4)
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Administrative scope required.' }, { status: 403 });
    }

    // 2. Poll native host system hardware parameters
    const cpuLoad = os.loadavg()[0]; // 1 min load average
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const uptime = os.uptime();

    // 3. Query active WebSocket sessions registry from Global scope (Express WS attached registry)
    const activeCount = (globalThis as any).activeSSHCount?.() || 0;
    const activeSessions = (globalThis as any).getActiveSessions?.() || [];

    // 4. Return standard response shape
    return NextResponse.json({
      data: {
        cpuLoad: Math.round(cpuLoad * 100) / 100, // round to 2 decimals
        freeMem,
        totalMem,
        uptime,
        activeSessions: activeCount,
        sessions: activeSessions,
      },
      ok: true,
    });

  } catch (error: any) {
    console.error('Failed to compile admin metrics:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
