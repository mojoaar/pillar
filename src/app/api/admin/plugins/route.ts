import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { AVAILABLE_PLUGINS } from '@/lib/plugins/registry';
import { getPluginConfig, savePluginConfig } from '@/lib/plugins/service';
import { maskSecret } from '@/lib/crypto';
import { writeAudit } from '@/lib/audit';

/**
 * GET /api/admin/plugins
 * Lists all available plugins with current configuration fields sanitized for administration UI.
 * Restricted to administrators (ADMIN role) only.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Load enabled statuses from DB
    const dbPlugins = await db.plugin.findMany();
    const statusMap = new Map(dbPlugins.map((p) => [p.id, p.enabled]));

    const responseData = await Promise.all(
      AVAILABLE_PLUGINS.map(async (plugin) => {
        const isEnabled = statusMap.get(plugin.id) || false;
        
        // Load decrypted config, and sanitize/mask secrets for UI output
        const rawConfig = await getPluginConfig(plugin.id, false) || {};
        const sanitizedConfig: Record<string, string> = {};

        plugin.configFields.forEach((field) => {
          const val = rawConfig[field.key] || '';
          if (field.type === 'password' && val) {
            sanitizedConfig[field.key] = maskSecret(val);
          } else {
            sanitizedConfig[field.key] = val;
          }
        });

        return {
          ...plugin,
          enabled: isEnabled,
          config: sanitizedConfig,
        };
      })
    );

    return NextResponse.json({ data: responseData, ok: true });
  } catch (err: any) {
    console.error('[API Admin Plugins GET] Failed:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/plugins
 * Updates a specific plugin configuration and enabled toggle.
 * Restricted to administrators (ADMIN role) only.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id: pluginId, enabled, config } = body;

    if (!pluginId) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const definition = AVAILABLE_PLUGINS.find((p) => p.id === pluginId);
    if (!definition) {
      return NextResponse.json({ error: 'Unknown plugin identifier' }, { status: 404 });
    }

    // Merge existing configuration to handle masked secrets
    const existingConfig = await getPluginConfig(pluginId, false) || {};
    const finalConfig: Record<string, any> = {};

    definition.configFields.forEach((field) => {
      let submittedValue = config[field.key];
      
      // Unchecked checkboxes are not sent by the browser — default to 'false'
      if (field.type === 'checkbox' && submittedValue === undefined) {
        submittedValue = 'false';
      }

      // If field is password, and matches maskSecret's output, retain existing decrypted value!
      if (field.type === 'password' && submittedValue === maskSecret('dummy')) {
        finalConfig[field.key] = existingConfig[field.key] || '';
      } else {
        finalConfig[field.key] = submittedValue;
      }
    });

    // Save and encrypt configuration
    await savePluginConfig(pluginId, !!enabled, finalConfig);

    // Log administrative action to Audit Logs
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(
      session.user.id as string,
      'Plugin Configuration Updated',
      ip,
      { pluginId, enabled: !!enabled }
    );

    return NextResponse.json({ message: 'Plugin configured successfully', ok: true });
  } catch (err: any) {
    console.error('[API Admin Plugins PATCH] Failed:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
