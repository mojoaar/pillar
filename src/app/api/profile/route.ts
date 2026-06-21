import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { writeAudit } from '@/lib/audit';

/**
 * PATCH /api/profile
 * Updates the user's name, username, email, or password.
 * Implements strict security validations including currentPassword verification (Gotcha #37).
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, username, email, currentPassword, newPassword } = body;

    // 1. Fetch current user record
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updateData: any = {};

    // 2. Handle Text Fields (name, username, email) Updates
    if (name !== undefined) updateData.name = name.trim();
    
    if (username !== undefined) {
      const cleanUsername = username.toLowerCase().trim();
      const usernameRegex = /^[a-zA-Z0-9_-]+$/;
      if (!usernameRegex.test(cleanUsername)) {
        return NextResponse.json(
          { error: 'Username may only contain letters, numbers, underscores, and dashes.' },
          { status: 400 }
        );
      }
      
      // Check if username is already taken by another user
      if (cleanUsername !== user.username) {
        const taken = await db.user.findUnique({ where: { username: cleanUsername } });
        if (taken) {
          return NextResponse.json({ error: 'Username is already taken.' }, { status: 400 });
        }
        updateData.username = cleanUsername;
      }
    }

    if (email !== undefined) {
      const cleanEmail = email.toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return NextResponse.json({ error: 'Invalid email address format.' }, { status: 400 });
      }

      // Check if email is already taken by another user
      if (cleanEmail !== user.email) {
        const taken = await db.user.findUnique({ where: { email: cleanEmail } });
        if (taken) {
          return NextResponse.json({ error: 'Email address is already in use.' }, { status: 400 });
        }
        updateData.email = cleanEmail;
      }
    }

    // 3. Handle Password Updates (Strict gotcha #37 validation)
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Verification required. Enter your current password to modify security settings.' },
          { status: 400 }
        );
      }

      // Verify current password matches DB hash
      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return NextResponse.json({ error: 'Incorrect current password. Verification failed.' }, { status: 400 });
      }

      // Validate new password rules
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'New password must be at least 8 characters long.' }, { status: 400 });
      }

      // Hash new password using bcryptjs
      const salt = await bcrypt.genSalt(12);
      updateData.passwordHash = await bcrypt.hash(newPassword, salt);
    }

    // 4. Perform SQLite updates
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: updateData,
    });

    // 5. Log audit trail
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(
      user.id,
      newPassword ? 'Password Changed' : 'Profile Updated',
      ip,
      { message: newPassword ? 'User updated account credentials.' : 'User modified account settings.' }
    );

    return NextResponse.json({
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        name: updatedUser.name,
        role: updatedUser.role,
        avatarUrl: updatedUser.avatarUrl,
      },
      ok: true,
    });

  } catch (error: any) {
    console.error('Failed to update user profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
