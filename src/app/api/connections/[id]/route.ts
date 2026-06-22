import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { writeAudit } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/connections/[id]
 * Updates a secure connection profile.
 * Only the owner may edit connection profile settings (BOLA check).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch current connection profile settings
    const connection = await db.connection.findUnique({
      where: { id },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 2. Enforce BOLA owner authorization scope checks (Security mandate #3)
    if (connection.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Parse request body updates
    const body = await request.json();
    const { name, host, domain, port, protocol, tags, username, authType, password, privateKey, passphrase, ignoreCert } = body;

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (host) updateData.host = host.trim();
    if (domain !== undefined) updateData.domain = domain ? domain.trim() : null;
    if (port !== undefined && port !== null) {
      const parsedPort = Number(port);
      if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        return NextResponse.json({ error: 'Port must be between 1 and 65535.' }, { status: 400 });
      }
      updateData.port = parsedPort;
    }
    if (protocol) {
      updateData.protocol = ['SSH', 'VNC'].includes(protocol) ? protocol : 'SSH';
    }
    if (ignoreCert !== undefined) {
      updateData.ignoreCert = Boolean(ignoreCert);
    }
    
    // Sanitize incoming tags updates (Finding #tags)
    if (tags !== undefined) {
      if (tags) {
        const parsedTags = Array.isArray(tags) 
          ? tags 
          : typeof tags === 'string' 
            ? tags.split(',') 
            : [];
        const cleanList = parsedTags
          .map((t: string) => t.trim().toLowerCase())
          .filter((t: string) => t.length > 0);
        updateData.tags = cleanList.length > 0 ? Array.from(new Set(cleanList)).join(',') : null;
      } else {
        updateData.tags = null;
      }
    }

    if (username) updateData.username = username.trim();
    if (authType) updateData.authType = authType === 'KEY' ? 'KEY' : 'PASSWORD';

    // Re-encrypt updated credentials if changed (Security mandate #1)
    if (authType === 'PASSWORD') {
      if (password) {
        updateData.password = encrypt(password);
      }
      // Clean up opposite auth settings if switching modes
      updateData.privateKey = null;
      updateData.passphrase = null;
    } else if (authType === 'KEY') {
      if (privateKey) {
        updateData.privateKey = encrypt(privateKey);
      }
      if (passphrase) {
        updateData.passphrase = encrypt(passphrase);
      }
      // Clean up opposite auth settings
      updateData.password = null;
    }

    // 4. Update SQLite connection settings
    const updated = await db.connection.update({
      where: { id },
      data: updateData,
    });

    // 5. Write event to system audit logs
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(
      session.user.id as string,
      'SSH Profile Updated',
      ip,
      { connectionId: updated.id, name: updated.name, host: updated.host }
    );

    return NextResponse.json({
      data: {
        id: updated.id,
        name: updated.name,
        host: updated.host,
        domain: updated.domain,
        port: updated.port,
        username: updated.username,
        authType: updated.authType,
      },
      ok: true,
    });

  } catch (error: any) {
    console.error('Failed to update connection profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/connections/[id]
 * Deletes a secure connection profile.
 * Only the owner may delete connection profiles (BOLA check).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch current connection profile
    const connection = await db.connection.findUnique({
      where: { id },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 2. Enforce BOLA owner scope verification (Security mandate #3)
    if (connection.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Delete connection profile (dependent sharedConnection entries cascade delete automatically)
    await db.connection.delete({
      where: { id },
    });

    // 4. Write event to system audit logs
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(
      session.user.id as string,
      'SSH Profile Deleted',
      ip,
      { connectionId: connection.id, name: connection.name, host: connection.host }
    );

    return NextResponse.json({ ok: true, message: 'Connection profile deleted successfully.' });

  } catch (error: any) {
    console.error('Failed to delete connection profile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
