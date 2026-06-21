import { db } from '../db';
import { encrypt, decrypt } from '../crypto';

/**
 * Checks if a user has access permissions to a specific plugin.
 * - ADMIN role users automatically have access to all plugins.
 * - USER role users must have the plugin ID listed in their `allowedPlugins` column.
 */
export async function hasPluginAccess(userId: string, role: string, pluginId: string): Promise<boolean> {
  if (role === 'ADMIN') return true;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { allowedPlugins: true }
  });

  if (!user || !user.allowedPlugins) return false;

  const allowed = user.allowedPlugins.split(',').map((p) => p.trim());
  return allowed.includes(pluginId);
}

/**
 * Returns the fully decrypted configuration object for a plugin.
 * Returns null if the plugin record doesn't exist or is not enabled.
 */
export async function getPluginConfig(pluginId: string, requireEnabled = true): Promise<any | null> {
  const record = await db.plugin.findUnique({
    where: { id: pluginId }
  });

  if (!record) return null;
  if (requireEnabled && !record.enabled) return null;
  if (!record.config) return {};

  try {
    const decrypted = decrypt(record.config);
    return JSON.parse(decrypted);
  } catch (err) {
    console.error(`[Plugin Service] Failed to decrypt configuration for plugin ${pluginId}:`, err);
    return null;
  }
}

/**
 * Encrypts and saves the configuration object for a plugin, updating its enabled state.
 */
export async function savePluginConfig(pluginId: string, enabled: boolean, config: any): Promise<void> {
  const jsonStr = JSON.stringify(config);
  const encrypted = encrypt(jsonStr);

  await db.plugin.upsert({
    where: { id: pluginId },
    create: {
      id: pluginId,
      enabled,
      config: encrypted
    },
    update: {
      enabled,
      config: encrypted
    }
  });
}
