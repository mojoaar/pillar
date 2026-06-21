import { db } from './db';

/**
 * Writes a system audit log record. This helper is wrapped in a try-catch block 
 * to ensure that audit log persistence failures never disrupt critical user actions.
 */
export async function writeAudit(
  userId: string | null,
  event: string,
  ip?: string | null,
  meta?: Record<string, any>
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId,
        event,
        ip: ip || null,
        meta: meta ? JSON.stringify(meta) : null,
      },
    });
  } catch (error) {
    // Silently log the failure to standard error to prevent throwing and disrupting primary user flows
    console.error('Failed to persist audit log entry:', error);
  }
}
