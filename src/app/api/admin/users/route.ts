import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { writeAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users
 * Returns a list of all local accounts.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Administrative scope required.' }, { status: 403 });
    }

    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        role: true,
        mfaEnabled: true,
        mfaEnforced: true,
        isSuspended: true,
        avatarUrl: true,
        allowedPlugins: true,
        maxSessions: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: users, ok: true });

  } catch (error: any) {
    console.error('Failed to list user accounts:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/users
 * Registers a new local account.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Administrative scope required.' }, { status: 403 });
    }

    const body = await request.json();
    const { email, username, name, password, role: targetRole } = body;

    // Validate parameters
    if (!email || !username || !name || !password || !targetRole) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username.toLowerCase().trim();

    // Check uniqueness
    const existing = await db.user.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          { username: cleanUsername },
        ],
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Email or Username is already registered in system.' }, { status: 400 });
    }

    // Hash password using bcryptjs
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user in DB
    const created = await db.user.create({
      data: {
        email: cleanEmail,
        username: cleanUsername,
        name: name.trim(),
        passwordHash,
        role: targetRole === 'ADMIN' ? 'ADMIN' : 'USER',
        mfaEnabled: false,
      },
    });

    // Write audit log
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(
      session.user.id as string,
      'User Account Created',
      ip,
      { message: `Admin created local account: ${created.username}`, email: created.email, role: created.role }
    );

    return NextResponse.json({
      data: {
        id: created.id,
        email: created.email,
        username: created.username,
        name: created.name,
        role: created.role,
        createdAt: created.createdAt,
      },
      ok: true,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Failed to create account:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
