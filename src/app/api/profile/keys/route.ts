import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { writeAudit } from '@/lib/audit';

function generateApiToken(): { raw: string; prefix: string; hash: string } {
  const randomBytes = crypto.randomBytes(32).toString('hex'); // 64 hex chars, 256-bit entropy
  const prefix = 'pil_live_' + randomBytes.substring(0, 8);
  const raw = prefix + randomBytes.substring(8);
  const pepper = process.env.ENCRYPTION_KEY || 'pillar-pepper';
  const hash = crypto.createHmac('sha256', pepper).update(raw).digest('hex');
  return { raw, prefix, hash };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keys = await db.apiKey.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return NextResponse.json({ data: keys, ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, expiresDays } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Key name is required.' }, { status: 400 });
    }

    const { raw, prefix, hash } = generateApiToken();

    const expiresAt = expiresDays && expiresDays > 0
      ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000)
      : null;

    await db.apiKey.create({
      data: {
        userId: session.user.id!,
        name: name.trim(),
        keyHash: hash,
        prefix,
        expiresAt,
      },
    });

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(session.user.id as string, 'API Key Generated', ip, { keyName: name.trim() });

    return NextResponse.json({ data: { token: raw, prefix }, ok: true });
  } catch (err: any) {
    console.error('[API Key Create] Failed:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json({ error: 'Missing key id' }, { status: 400 });
    }

    const key = await db.apiKey.findFirst({
      where: { id: keyId, userId: session.user.id },
    });

    if (!key) {
      return NextResponse.json({ error: 'Key not found or access denied.' }, { status: 404 });
    }

    await db.apiKey.delete({ where: { id: keyId } });

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(session.user.id as string, 'API Key Revoked', ip, { keyName: key.name, keyPrefix: key.prefix });

    return NextResponse.json({ ok: true, message: 'API key revoked permanently.' });
  } catch (err: any) {
    console.error('[API Key Delete] Failed:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
