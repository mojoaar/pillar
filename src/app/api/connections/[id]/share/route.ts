import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { writeAudit } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/connections/[id]/share
 * Shares an SSH connection profile with another local user.
 * Only the owner of the connection profile may authorize shares (BOLA check).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch connection profile
    const connection = await db.connection.findUnique({
      where: { id },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 2. Enforce BOLA owner authorization verification (Security mandate #3)
    if (connection.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Read share target user parameters from body
    const body = await request.json();
    const { userId: targetUserId } = body;

    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing target user parameters.' }, { status: 400 });
    }

    // Verify target user actually exists
    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Target sharing user not found.' }, { status: 404 });
    }

    if (targetUser.id === session.user.id) {
      return NextResponse.json({ error: 'You cannot share connection profiles with yourself.' }, { status: 400 });
    }

    // 4. Create sharing association in SharedConnection join table
    await db.sharedConnection.upsert({
      where: {
        connectionId_userId: {
          connectionId: connection.id,
          userId: targetUser.id,
        },
      },
      update: {}, // if already shared, perform no-op
      create: {
        connectionId: connection.id,
        userId: targetUser.id,
      },
    });

    // Mark parent connection record as shared
    await db.connection.update({
      where: { id: connection.id },
      data: { isShared: true },
    });

    // 5. Write event to system audit logs
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(
      session.user.id as string,
      'SSH Profile Shared',
      ip,
      { connectionId: connection.id, name: connection.name, sharedWith: targetUser.username }
    );

    return NextResponse.json({ ok: true, message: `SSH profile shared with ${targetUser.username}.` });

  } catch (error: any) {
    console.error('Failed to share connection profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
