import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPluginAccess, getPluginConfig } from '@/lib/plugins/service';
import { ProxmoxClient } from '@/lib/plugins/proxmox';
import { writeAudit } from '@/lib/audit';

/**
 * GET /api/plugins/proxmox
 * Returns real-time status details of the Proxmox cluster nodes and VM resources.
 * Supports on-demand status querying for authorized users.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id!;
    const role = (session.user as any).role || 'USER';

    // Verify user-level authorization to access Proxmox VE plugin (Security mandate #3)
    const isAuthorized = await hasPluginAccess(userId, role, 'proxmox-ve');
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden. Plugin access not permitted.' }, { status: 403 });
    }

    // Retrieve decrypted config
    const config = await getPluginConfig('proxmox-ve');
    if (!config) {
      const record = await (await import('@/lib/db')).db.plugin.findUnique({ where: { id: 'proxmox-ve' } });
      console.log('[Proxmox API] Plugin record:', record ? `enabled=${record.enabled}, config=${!!record.config}` : 'NOT FOUND');
      return NextResponse.json({ enabled: false, message: 'Proxmox VE integration is disabled or not configured.' });
    }

    // Initialize Proxmox client
    const client = new ProxmoxClient({
      apiUrl: config.apiUrl,
      apiToken: config.apiToken,
      verifySsl: config.verifySsl !== 'false' && config.verifySsl !== false
    });

    // Test connection first
    const isAlive = await client.testConnection();
    if (!isAlive) {
      return NextResponse.json({ 
        enabled: true, 
        connected: false, 
        message: 'Could not connect to Proxmox VE API. Please verify endpoint URL, token keys, and SSL configurations.' 
      });
    }

    // Fetch nodes, resources, and real-time node status in parallel
    const [nodes, resources] = await Promise.all([
      client.getNodes(),
      client.getClusterResources()
    ]);

    // Fetch real-time CPU/Memory for each node
    const nodeStatuses = await Promise.all(
      nodes.map((n: any) => client.getNodeStatus(n.node).then((s: any) => ({ node: n.node, ...s })))
    );

    // Merge status data into node objects
    const enrichedNodes = nodes.map((n: any) => {
      const stats = nodeStatuses.find((s: any) => s.node === n.node) || {};
      return {
        ...n,
        cpu: stats.cpu ?? n.cpu,
        maxcpu: stats.cpuinfo?.cpus ?? n.maxcpu,
        mem: stats.memory?.used ?? n.mem,
        maxmem: stats.memory?.total ?? n.maxmem,
      };
    });

    return NextResponse.json({
      enabled: true,
      connected: true,
      data: {
        nodes: enrichedNodes,
        resources: resources.filter((r) => r.type === 'qemu' || r.type === 'lxc' || r.type === 'node')
      },
      ok: true
    });

  } catch (err: any) {
    console.error('[API Plugins Proxmox GET] Failed:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/plugins/proxmox
 * Triggers power lifecycle commands ('start', 'stop', 'shutdown', 'reboot', 'suspend')
 * on target VMs or LXC containers.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id!;
    const role = (session.user as any).role || 'USER';

    // Verify authorization
    const isAuthorized = await hasPluginAccess(userId, role, 'proxmox-ve');
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { node, vmid, type, action } = body;

    if (!node || vmid === undefined || vmid === null || !type || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (type !== 'qemu' && type !== 'lxc') {
      return NextResponse.json({ error: 'Invalid resource type' }, { status: 400 });
    }

    if (!['start', 'stop', 'shutdown', 'reboot', 'suspend'].includes(action)) {
      return NextResponse.json({ error: 'Invalid lifecycle action' }, { status: 400 });
    }

    // Load config
    const config = await getPluginConfig('proxmox-ve');
    if (!config) {
      return NextResponse.json({ error: 'Plugin is not active.' }, { status: 400 });
    }

    const client = new ProxmoxClient({
      apiUrl: config.apiUrl,
      apiToken: config.apiToken,
      verifySsl: config.verifySsl !== 'false' && config.verifySsl !== false
    });

    // Execute remote lifecycle control instruction
    const res = await client.controlVm(node, Number(vmid), type, action);

    // Record to Audit logs
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    await writeAudit(
      userId,
      'Proxmox VM Lifecycle Triggered',
      ip,
      { node, vmid, type, action }
    );

    return NextResponse.json({ data: res, message: `Lifecycle action ${action} dispatched successfully.`, ok: true });

  } catch (err: any) {
    console.error('[API Plugins Proxmox POST] Failed:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
