import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { writeAudit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    // 1. Guard against subsequent executions (Setup is single-use only)
    const existingUserCount = await db.user.count();
    if (existingUserCount > 0) {
      return NextResponse.json(
        { error: 'System has already been configured and initialized.' },
        { status: 400 }
      ) as any;
    }

    // 2. Parse request body
    const body = await request.json();
    const { email, username, name, password } = body;

    // 3. Inputs validation
    if (!email || !username || !name || !password) {
      return NextResponse.json(
        { error: 'Missing required parameters. Complete all fields.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    // Validate email format simply
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address format.' },
        { status: 400 }
      );
    }

    // Validate username format (kebab-case or alpha-numeric, no special chars except dashes/underscores)
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { error: 'Username may only contain letters, numbers, underscores, and dashes.' },
        { status: 400 }
      );
    }

    // 4. Secure Password hashing using bcryptjs
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // 5. Create admin user in SQLite database
    const adminUser = await db.user.create({
      data: {
        email: email.toLowerCase().trim(),
        username: username.toLowerCase().trim(),
        name: name.trim(),
        passwordHash,
        role: 'ADMIN', // Auto-promoted first user to ADMIN
        mfaEnabled: false,
      },
    });

    // 6. Write to Audit Log (masked metadata)
    // Attempt to extract caller IP if present in request headers
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(
      adminUser.id,
      'System Initialized',
      ip,
      { message: 'First administrator account created.', username: adminUser.username }
    );

    // 7. Standard single-resource JSON response
    return NextResponse.json({
      data: {
        id: adminUser.id,
        email: adminUser.email,
        username: adminUser.username,
        role: adminUser.role,
        createdAt: adminUser.createdAt,
      },
      ok: true,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Fatal during setup API execution:', error);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred during configuration.' },
      { status: 500 }
    );
  }
}
