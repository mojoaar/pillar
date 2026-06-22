import https from 'https';

interface ProxmoxConfig {
  apiUrl: string;
  apiToken: string;
  verifySsl?: boolean;
}

/**
 * Perform a secure HTTPS request using Node's native https module.
 * This guarantees perfect support for self-signed certificates with `rejectUnauthorized: false`.
 */
function httpsRequest(
  url: string,
  method: 'GET' | 'POST',
  headers: Record<string, string>,
  postData?: string,
  verifySsl = true
): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const opts: https.RequestOptions & { headers: Record<string, string> } = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: { ...headers },
      rejectUnauthorized: verifySsl,
    };

    if (postData) {
      opts.headers['Content-Length'] = String(Buffer.byteLength(postData));
    }

    const req = https.request(opts, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ raw: data });
          }
        } else {
          reject(new Error(`Proxmox API returned status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Maps Proxmox ostype config codes to human-readable OS labels
const OS_TYPE_MAP: Record<string, string> = {
  l24: 'Linux 2.4', l26: 'Linux', debian: 'Debian', ubuntu: 'Ubuntu',
  centos: 'CentOS', fedora: 'Fedora', alpine: 'Alpine', archlinux: 'Arch',
  opensuse: 'openSUSE',
  win7: 'Windows 7', win8: 'Windows 8', win10: 'Windows 10', win11: 'Windows 11',
  w2k19: 'Windows Server 2019', w2k22: 'Windows Server 2022', win2025: 'Windows Server 2025',
  solaris: 'Solaris', other: 'Other',
};

export class ProxmoxClient {
  private apiUrl: string;
  private apiToken: string;
  private verifySsl: boolean;

  constructor(config: ProxmoxConfig) {
    this.apiUrl = config.apiUrl.endsWith('/') ? config.apiUrl.slice(0, -1) : config.apiUrl;
    this.apiToken = config.apiToken;
    this.verifySsl = config.verifySsl !== false; // default true, false if explicitly set
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `PVEAPIToken=${this.apiToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Test connection to the Proxmox cluster (Fetches version)
   */
  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.apiUrl}/version`;
      await httpsRequest(url, 'GET', this.getHeaders(), undefined, this.verifySsl);
      return true;
    } catch (err) {
      console.error('[Proxmox Client] Connection test failed:', err);
      return false;
    }
  }

  /**
   * Fetches cluster nodes
   */
  async getNodes(): Promise<any[]> {
    const url = `${this.apiUrl}/nodes`;
    const res = await httpsRequest(url, 'GET', this.getHeaders(), undefined, this.verifySsl);
    return res.data || [];
  }

  /**
   * Fetches resource list (including all VMs and Containers in cluster)
   */
  async getClusterResources(): Promise<any[]> {
    const url = `${this.apiUrl}/cluster/resources`;
    const res = await httpsRequest(url, 'GET', this.getHeaders(), undefined, this.verifySsl);
    return res.data || [];
  }

  /**
   * Fetches cluster status (includes node IP addresses).
   */
  async getClusterStatus(): Promise<any[]> {
    const url = `${this.apiUrl}/cluster/status`;
    const res = await httpsRequest(url, 'GET', this.getHeaders(), undefined, this.verifySsl);
    return res.data || [];
  }

  /**
   * Fetches VM/LXC config (includes network interface info).
   */
  async getVmConfig(node: string, vmid: number, type: 'qemu' | 'lxc'): Promise<any> {
    const url = `${this.apiUrl}/nodes/${node}/${type}/${vmid}/config`;
    const res = await httpsRequest(url, 'GET', this.getHeaders(), undefined, this.verifySsl);
    return res.data || {};
  }

  /**
   * Tries to get the actual IP address of a VM/LXC via QEMU guest agent.
   * Returns the first IPv4 address found, or null if the guest agent is not available.
   */
  async getVmIp(node: string, vmid: number, type: 'qemu' | 'lxc'): Promise<string | null> {
    // LXC containers don't have a QEMU guest agent — IP must come from config
    if (type === 'lxc') return null;

    try {
      // Proxmox agent API uses POST with command in body
      const url = `${this.apiUrl}/nodes/${node}/${type}/${vmid}/agent`;
      const res = await httpsRequest(url, 'POST', this.getHeaders(), JSON.stringify({ command: 'network-get-interfaces' }), this.verifySsl);
      const ifaces = res.data?.result || [];
      for (const iface of ifaces) {
        const ips = iface['ip-addresses'] || [];
        for (const ip of ips) {
          if (ip['ip-address-type'] === 'ipv4' && ip['ip-address'] !== '127.0.0.1') {
            return ip['ip-address'];
          }
        }
      }
      return null;
    } catch (err: any) {
      console.warn(`[Proxmox Client] Agent query failed for ${type}/${vmid} on ${node}: ${err.message}`);
      return null;
    }
  }

  /**
   * Sends a power state action/command to a target VM or LXC container
   * @param node The Proxmox node hosting the VM
   * @param vmid The numeric virtual machine identifier
   * @param type 'qemu' (for VMs) or 'lxc' (for containers)
   * @param action 'start', 'stop', 'shutdown', 'reboot', 'suspend'
   */
  async controlVm(node: string, vmid: number, type: 'qemu' | 'lxc', action: 'start' | 'stop' | 'shutdown' | 'reboot' | 'suspend'): Promise<any> {
    const url = `${this.apiUrl}/nodes/${node}/${type}/${vmid}/status/${action}`;
    const res = await httpsRequest(url, 'POST', this.getHeaders(), '{}', this.verifySsl);
    return res.data || res;
  }

  /**
   * Requests a VNC proxy ticket for a running VM, returning the port and ticket
   * required to establish a secure WebSocket console connection.
   */
  async getVncProxyTicket(node: string, vmid: number, type: 'qemu' | 'lxc'): Promise<{ port: number; ticket: string }> {
    const url = `${this.apiUrl}/nodes/${node}/${type}/${vmid}/vncproxy`;
    const res = await httpsRequest(url, 'POST', this.getHeaders(), JSON.stringify({ websocket: 1 }), this.verifySsl);
    return {
      port: res.data?.port || 5900,
      ticket: res.data?.ticket || '',
    };
  }

  /**
   * Tries to get detailed OS info from QEMU guest agent (running VMs only).
   * Returns human-readable OS name, or null if guest agent is not available.
   */
  async getVmOsInfo(node: string, vmid: number): Promise<string | null> {
    try {
      const url = `${this.apiUrl}/nodes/${node}/qemu/${vmid}/agent`;
      const res = await httpsRequest(
        url, 'POST', this.getHeaders(),
        JSON.stringify({ command: 'get-osinfo' }),
        this.verifySsl
      );
      const result = res.data?.result;
      return result?.['pretty-name'] || result?.name || null;
    } catch {
      return null;
    }
  }

  /**
   * Maps a raw Proxmox ostype config string to a human-readable OS label.
   */
  static mapOsType(ostype: string): string {
    return OS_TYPE_MAP[ostype] || ostype || 'Unknown';
  }

  /**
   * Fetches real-time status for a single node (CPU load, memory usage).
   */
  async getNodeStatus(node: string): Promise<any> {
    const url = `${this.apiUrl}/nodes/${node}/status`;
    const res = await httpsRequest(url, 'GET', this.getHeaders(), undefined, this.verifySsl);
    return res.data || {};
  }
}
