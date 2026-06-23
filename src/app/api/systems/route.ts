import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { detectOS } from '@/lib/remote-exec';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id as string;
    const role = (session.user as any).role;

    // Only connections owned by the user or shared with them, with allowRemoteExec enabled
    const connections = await db.connection.findMany({
      where: {
        allowRemoteExec: true,
        OR: [
          { userId },
          { sharedWith: { some: { userId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        protocol: true,
        osType: true,
        pollIntervalMin: true,
        userId: true,
        tags: true,
      },
      orderBy: { name: 'asc' },
    });

    // Detect OS for each system in parallel (with individual error handling)
    const results = await Promise.allSettled(
      connections.map(async (conn: any) => {
        try {
          const info = await detectOS(conn.id);
          return {
            id: conn.id,
            name: conn.name,
            host: conn.host,
            port: conn.port,
            protocol: conn.protocol,
            osType: conn.osType,
            pollIntervalMin: conn.pollIntervalMin,
            isOwner: conn.userId === userId,
            tags: conn.tags ? conn.tags.split(',') : ([] as string[]),
            ...info,
            status: 'online' as const,
            error: null,
          };
        } catch (err: any) {
          return {
            id: conn.id,
            name: conn.name,
            host: conn.host,
            port: conn.port,
            protocol: conn.protocol,
            osType: conn.osType,
            pollIntervalMin: conn.pollIntervalMin,
            isOwner: conn.userId === userId,
            tags: conn.tags ? conn.tags.split(',') : ([] as string[]),
            osName: 'Unknown',
            osVersion: '',
            prettyName: 'Unknown',
            kernel: 'Unknown',
            uptime: 'Unknown',
            lastChecked: new Date().toISOString(),
            status: 'error' as const,
            error: err.message || 'Connection failed',
          };
        }
      })
    );

    const systems = results.map((r: any) =>
      r.status === 'fulfilled' ? r.value : null
    ).filter(Boolean);

    return NextResponse.json({ systems, ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
