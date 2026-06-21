import crypto from 'crypto';
import { auth } from './auth';
import { db } from './db';

/**
 * Unified dual-strategy authentication guard for API routes.
 * Returns user context whether the caller authenticates with a browser session cookie
 * or with a Bearer API token header.
 */
export async function authenticateRequest(request: Request) {
  const session = await auth();
  if (session?.user) {
    return { user: session.user, authType: 'SESSION' as const };
  }

  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const rawToken = authHeader.substring(7).trim();
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

    const apiKeyRecord = await db.apiKey.findFirst({
      where: { keyHash: hashed },
      include: { user: true }
    });

    if (apiKeyRecord && !apiKeyRecord.user.isSuspended) {
      if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
        return null;
      }

      return {
        user: {
          id: apiKeyRecord.userId,
          email: apiKeyRecord.user.email,
          name: apiKeyRecord.user.name,
          role: apiKeyRecord.user.role,
          username: apiKeyRecord.user.username,
        },
        authType: 'API_KEY' as const
      };
    }
  }

  return null;
}
