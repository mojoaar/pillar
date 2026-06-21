import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit
 * Fetches paginated, filterable database audit logs.
 * Restricted to users with the ADMIN role (Security mandate #4).
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Enforce strict ADMIN authorization checks (Security mandate #4)
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Administrative scope required.' }, { status: 403 });
    }

    // 2. Parse query parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '25', 10), 100);
    const userId = url.searchParams.get('userId') || undefined;
    const event = url.searchParams.get('event') || undefined;
    const ip = url.searchParams.get('ip') || undefined;

    const offset = (page - 1) * limit;

    // 3. Compile filters
    const where: any = {};
    if (userId) where.userId = userId;
    if (event) where.event = { contains: event };
    if (ip) where.ip = { contains: ip };

    // 4. Query DB in parallel (Fetch logs + Count total records matching filters)
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        take: limit,
        skip: offset,
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
      db.auditLog.count({ where }),
    ]);

    // 5. Standard paginated list JSON response
    return NextResponse.json({
      data: logs,
      total,
      page,
      limit,
      ok: true,
    });

  } catch (error: any) {
    console.error('Failed to load audit logs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
