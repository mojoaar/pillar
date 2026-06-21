import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

/**
 * POST /api/profile/mfa/generate
 * Initiates TOTP MFA enrollment by generating a secure secret and QR Code.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Generate secure random base32 secret
    const secret = authenticator.generateSecret();

    // 2. Generate standard otpauth parameters URI
    const issuer = 'Pillar Gateway';
    const otpauth = authenticator.keyuri(session.user.email || 'user', issuer, secret);

    // 3. Render parameters URI to QR Code data URL using qrcode package
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

    // 4. Encrypt the secret and save temporarily in DB (mfaEnabled remains false until verified)
    const encryptedSecret = encrypt(secret);
    await db.user.update({
      where: { id: session.user.id },
      data: {
        mfaSecret: encryptedSecret,
      },
    });

    return NextResponse.json({
      data: {
        secret, // display secret to user for manual entries
        qrCode: qrCodeDataUrl,
      },
      ok: true,
    });

  } catch (error: any) {
    console.error('Failed to generate MFA secret:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
