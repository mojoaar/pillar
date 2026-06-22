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

    // Fetch nodes, resources, cluster status (for IPs), and node statuses
    const [nodes, resources, clusterStatus] = await Promise.all([
      client.getNodes(),
      client.getClusterResources(),
      client.getClusterStatus().catch(() => []),
    ]);

    // Merge cluster IP data into node info
    const nodeIps = new Map(clusterStatus.map((cs: any) => [cs.name, cs.ip]));

    // Fetch real-time CPU/Memory for each node (gracefully skip on permission errors)
    const nodeStatuses = await Promise.all(
      nodes.map((n: any) =>
        client.getNodeStatus(n.node)
          .then((s: any) => ({ node: n.node, ...s }))
          .catch((err: any) => {
            console.warn(`[Proxmox API] Skipping /nodes/${n.node}/status: ${err.message}`);
            return { node: n.node };
          })
      )
    );

    // Merge status data into node objects
    const enrichedNodes = nodes.map((n: any) => {
      const stats = nodeStatuses.find((s: any) => s.node === n.node) || {};
      return {
        ...n,
        ip: nodeIps.get(n.node) || null,
        os: stats.pveversion ? `Proxmox VE ${stats.pveversion}` : null,
        cpu: stats.cpu ?? n.cpu,
        maxcpu: stats.cpuinfo?.cpus ?? n.maxcpu,
        mem: stats.memory?.used ?? n.mem,
        maxmem: stats.memory?.total ?? n.maxmem,
      };
    });

    // Filter VMs/LXCs and enrich with config data
    const vmsAndContainers = resources.filter((r: any) => r.type === 'qemu' || r.type === 'lxc');
    const enrichedResources = await Promise.all(
      vmsAndContainers.map(async (r: any) => {
        try {
          const cfg = await client.getVmConfig(r.node, r.vmid, r.type);
          // Extract bridge name as fallback
          const netInfo = (cfg.net0 || cfg.net1 || '');
          const bridgeMatch = netInfo.match(/bridge=([^,\s]+)/);
          // For QEMU VMs: try guest agent; for LXCs: parse IP from config (net0=...ip=...)
          let ip: string | null = null;
          if (r.type === 'lxc') {
            const ipMatch = netInfo.match(/ip=([^/\s,]+)/);
            const rawIp = ipMatch ? ipMatch[1] : null;
            // Only accept actual IPv4 addresses, skip "dhcp" or other non-IP values
            ip = rawIp && /^\d+\.\d+\.\d+\.\d+$/.test(rawIp) ? rawIp : null;
          } else {
            try {
              ip = await client.getVmIp(r.node, r.vmid, r.type);
            } catch {}
          }
          // Extract OS type from config
          let os = cfg.ostype ? ProxmoxClient.mapOsType(cfg.ostype) : null;
          // Try guest agent for running QEMU VMs (best-effort, overrides config ostype)
          if (r.type === 'qemu' && r.status === 'running') {
            try {
              const guestOs = await client.getVmOsInfo(r.node, r.vmid);
              if (guestOs) os = guestOs;
            } catch {}
          }
          return { ...r, network: ip || (bridgeMatch ? bridgeMatch[1] : null), os };
        } catch {
          return r;
        }
      })
    );

    return NextResponse.json({
      enabled: true,
      connected: true,
      data: {
        nodes: enrichedNodes,
        resources: enrichedResources,
      },
      ok: true
    });

  } catch (err: any) {
    console.error('[API Plugins Proxmox GET] Failed:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
