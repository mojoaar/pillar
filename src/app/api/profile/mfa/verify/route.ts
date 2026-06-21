import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { authenticator } from 'otplib';
import { writeAudit } from '@/lib/audit';

/**
 * POST /api/profile/mfa/verify
 * Verifies the user's submitted TOTP token against the encrypted secret.
 * On success, sets mfaEnabled = true.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: 'Verification code is required.' }, { status: 400 });
    }

    // 1. Fetch user records
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.mfaSecret) {
      return NextResponse.json({ error: 'MFA setup has not been initialized.' }, { status: 400 });
    }

    // 2. Decrypt the secret (Security mandate #1)
    let decryptedSecret: string;
    try {
      decryptedSecret = decrypt(user.mfaSecret);
    } catch (err) {
      console.error('Failed to decrypt user MFA secret during verification:', err);
      return NextResponse.json({ error: 'Secret decryption error.' }, { status: 500 });
    }

    // 3. Verify submitted code using otplib
    const isValid = authenticator.check(code, decryptedSecret);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid verification code. Try again.' }, { status: 400 });
    }

    // 4. Verification succeeded. Fully enable TOTP MFA for this user.
    await db.user.update({
      where: { id: session.user.id },
      data: { mfaEnabled: true },
    });

    // 5. Write to system audit logs
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(
      user.id,
      'MFA Enrolled',
      ip,
      { message: 'TOTP Multi-Factor Authentication enrolled successfully.' }
    );

    return NextResponse.json({
      ok: true,
      message: 'Multi-Factor Authentication enabled successfully!',
    });

  } catch (error: any) {
    console.error('Failed to verify MFA token:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
