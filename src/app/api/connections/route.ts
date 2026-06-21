import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { writeAudit } from '@/lib/audit';

/**
 * GET /api/connections
 * List all connections belonging to the authenticated user OR shared with them.
 * This API is fully protected and enforces owner scope boundaries (BOLA).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connections = await db.connection.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          { sharedWith: { some: { userId: session.user.id } } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    // Safely serialize connections, stripping any sensitive encrypted fields before returning to client (BOLA precaution)
    const serialized = connections.map((c) => ({
      id: c.id,
      userId: c.userId,
      name: c.name,
      host: c.host,
      port: c.port,
      protocol: c.protocol, // include protocol (SSH / VNC)
      username: c.username,
      authType: c.authType,
      isShared: c.isShared,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({ data: serialized, ok: true });

  } catch (error: any) {
    console.error('Failed to list connections:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/connections
 * Create a new secure connection profile.
 * Sensitive fields (passwords, private keys, passphrases) are dynamically encrypted at rest.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, host, port, protocol, username, authType, password, privateKey, passphrase } = body;

    if (!name || !host || !username || !authType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Encrypt secrets securely before database insertion (Security mandate #1)
    const encryptedPassword = password ? encrypt(password) : null;
    const encryptedPrivateKey = privateKey ? encrypt(privateKey) : null;
    const encryptedPassphrase = passphrase ? encrypt(passphrase) : null;

    // 2. Insert secure connection profile into SQLite
    const connection = await db.connection.create({
      data: {
        userId: session.user.id as string,
        name: name.trim(),
        host: host.trim(),
        port: Number(port) || (protocol === 'VNC' ? 5900 : 22),
        protocol: protocol === 'VNC' ? 'VNC' : 'SSH',
        username: username.trim(),
        authType: authType === 'KEY' ? 'KEY' : 'PASSWORD',
        password: encryptedPassword,
        privateKey: encryptedPrivateKey,
        passphrase: encryptedPassphrase,
      }
    });

    // 3. Write event to system audit logs
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(
      session.user.id as string,
      'SSH Profile Created',
      ip,
      { connectionId: connection.id, name: connection.name, host: connection.host }
    );

    // 4. Return standard single-resource response
    return NextResponse.json({
      data: {
        id: connection.id,
        name: connection.name,
        host: connection.host,
        port: connection.port,
        username: connection.username,
        authType: connection.authType,
      },
      ok: true,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Failed to create connection:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
