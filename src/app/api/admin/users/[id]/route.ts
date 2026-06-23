import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { writeAudit } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/users/[id]
 * Administrative user modifications (role changes, suspension toggles, and MFA overrides).
 * Restricted to ADMIN role users (Security mandate #4).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // 1. Resolve session and enforce strict ADMIN role check (Security mandate #4)
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentRole = (session.user as any).role;
    if (currentRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Administrative scope required.' }, { status: 403 });
    }

    // 2. Fetch the target user profile
    const targetUser = await db.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Target account not found.' }, { status: 404 });
    }

    // Protect against self-modification lockouts
    if (targetUser.id === session.user.id) {
      return NextResponse.json({ error: 'You cannot suspend, demote, or modify your own active administrator account.' }, { status: 400 });
    }

    // 3. Parse request body parameters
    const body = await request.json();
    const { role: targetRole, isSuspended, resetMfa, allowedPlugins, maxSessions } = body;

    const updateData: any = {};
    const auditActions: string[] = [];

    if (targetRole !== undefined) {
      updateData.role = targetRole === 'ADMIN' ? 'ADMIN' : 'USER';
      auditActions.push(`Role changed to ${updateData.role}`);
    }

    if (isSuspended !== undefined) {
      updateData.isSuspended = !!isSuspended;
      auditActions.push(updateData.isSuspended ? 'Account Suspended' : 'Account Re-activated');
    }

    if (allowedPlugins !== undefined) {
      updateData.allowedPlugins = allowedPlugins;
      auditActions.push(`Allowed plugins updated to: ${allowedPlugins || 'none'}`);
    }

    if (maxSessions !== undefined) {
      const val = Math.max(1, Math.min(100, Number(maxSessions)));
      updateData.maxSessions = val;
      auditActions.push(`Session limit set to ${val}`);
    }

    // Handle Administrative MFA Override (resetting or disabling user MFA)
    if (resetMfa === true) {
      updateData.mfaEnabled = false;
      updateData.mfaSecret = null; // Purge secret at-rest securely
      auditActions.push('MFA Override Triggered — TOTP Disabled');
    }

    // 4. Update the target user record
    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        mfaEnabled: true,
        isSuspended: true,
        allowedPlugins: true,
        maxSessions: true,
      },
    });

    // 5. Write event log to System Audit Logs
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(
      session.user.id as string,
      resetMfa ? 'MFA Override Triggered' : 'User Settings Overridden',
      ip,
      { targetUserId: updated.id, targetUsername: updated.username, actions: auditActions }
    );

    return NextResponse.json({ data: updated, ok: true });

  } catch (error: any) {
    console.error('Failed to perform admin update:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Permanently deletes a user account from database.
 * Restricted to ADMIN role users (Security mandate #4).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 1. Enforce strict ADMIN authorization checks (Security mandate #4)
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentRole = (session.user as any).role;
    if (currentRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Administrative scope required.' }, { status: 403 });
    }

    // 2. Fetch the target user profile
    const targetUser = await db.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Target account not found.' }, { status: 404 });
    }

    // Block self-deletion
    if (targetUser.id === session.user.id) {
      return NextResponse.json({ error: 'You cannot delete your own active administrator account.' }, { status: 400 });
    }

    // 3. Delete user account from database (Casading deletes connections and logs)
    await db.user.delete({
      where: { id },
    });

    // 4. Write audit log entry
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(
      session.user.id as string,
      'User Account Deleted',
      ip,
      { targetUserId: targetUser.id, targetUsername: targetUser.username, email: targetUser.email }
    );

    return NextResponse.json({ ok: true, message: 'User account deleted successfully.' });

  } catch (error: any) {
    console.error('Failed to delete account:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
