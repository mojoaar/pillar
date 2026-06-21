import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';

// Helper to generate 8 single-use cryptographically secure backup codes
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${raw.substring(0, 4)}-${raw.substring(4)}`);
  }
  return codes;
}

/**
 * POST /api/profile/mfa/generate
 * Initiates TOTP MFA enrollment by generating a secure secret, QR Code, and 8 single-use recovery backup codes.
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

    // 4. Generate 8 secure, single-use recovery codes
    const backupCodes = generateBackupCodes();

    // 5. Encrypt both the secret and recovery codes before database insertion (Security mandate #1)
    const encryptedSecret = encrypt(secret);
    const encryptedBackupCodes = encrypt(backupCodes.join(','));

    await db.user.update({
      where: { id: session.user.id },
      data: {
        mfaSecret: encryptedSecret,
        mfaBackupCodes: encryptedBackupCodes, // Saved temporarily, fully activated upon verification
      },
    });

    return NextResponse.json({
      data: {
        secret, // Display secret to user for manual entries
        qrCode: qrCodeDataUrl,
        backupCodes, // Display backup codes only once during enrollment
      },
      ok: true,
    });

  } catch (error: any) {
    console.error('Failed to generate MFA secret & backup codes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
