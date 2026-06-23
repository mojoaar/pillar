import { Client } from 'ssh2';
import { decrypt } from './crypto';
import { db } from './db';

export interface SystemInfo {
  osName: string;
  osVersion: string;
  prettyName: string;
  kernel: string;
  uptime: string;
  lastChecked: string;
}

export interface UpdateCheckResult {
  packageCount: number;
  packageList: string[];
  checkedAt: string;
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

function execSSH(client: Client, command: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    client.exec(command, (err, stream) => {
      if (err) {
        return resolve({ success: false, stdout: '', stderr: err.message });
      }
      let stdout = '';
      let stderr = '';
      stream.on('data', (data: Buffer) => { stdout += data.toString(); });
      stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      stream.on('close', () => resolve({ success: true, stdout: stdout.trim(), stderr: stderr.trim() }));
    });
  });
}

function connectForCommand(
  host: string,
  port: number,
  username: string,
  authType: string,
  password: string | null,
  privateKey: string | null,
  passphrase: string | null,
  timeout: number = 15000
): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const timer = setTimeout(() => {
      conn.end();
      reject(new Error('Connection timed out'));
    }, timeout);

    conn.on('ready', () => {
      clearTimeout(timer);
      resolve(conn);
    });
    conn.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    const config: any = {
      host,
      port,
      username,
      readyTimeout: timeout,
      keepaliveInterval: 5000,
    };

    if (authType === 'PASSWORD') {
      if (!password) return reject(new Error('Password required'));
      config.password = password;
    } else {
      if (!privateKey) return reject(new Error('Private key required'));
      config.privateKey = privateKey;
      if (passphrase) config.passphrase = passphrase;
    }

    try {
      conn.connect(config);
    } catch (err) {
      reject(err);
    }
  });
}

export async function detectOS(connectionId: string): Promise<SystemInfo> {
  const connection = await db.connection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new Error('Connection not found');

  const password = connection.password ? decrypt(connection.password) : null;
  const privateKey = connection.privateKey ? decrypt(connection.privateKey) : null;
  const passphrase = connection.passphrase ? decrypt(connection.passphrase) : null;

  let client: Client | null = null;
  try {
    client = await connectForCommand(
      connection.host, connection.port, connection.username,
      connection.authType, password, privateKey, passphrase
    );

    const [osRelease, kernelResult, uptimeResult] = await Promise.all([
      execSSH(client, 'cat /etc/os-release 2>/dev/null || cat /usr/lib/os-release 2>/dev/null'),
      execSSH(client, 'uname -r'),
      execSSH(client, 'uptime -p 2>/dev/null || uptime'),
    ]);

    const osInfo = parseOsRelease(osRelease.stdout);
    const uptime = uptimeResult.success
      ? uptimeResult.stdout.replace(/^up\s+/i, '').trim()
      : 'Unknown';

    return {
      osName: osInfo.id || osInfo.name || 'Unknown',
      osVersion: osInfo.version_id || osInfo.version || '',
      prettyName: osInfo.pretty_name || `${osInfo.name || 'Linux'} ${osInfo.version_id || ''}`.trim(),
      kernel: kernelResult.success ? kernelResult.stdout : 'Unknown',
      uptime,
      lastChecked: new Date().toISOString(),
    };
  } finally {
    if (client) {
      try { client.end(); } catch (e) {}
    }
  }
}

function parseOsRelease(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

export async function checkUpdates(connectionId: string): Promise<UpdateCheckResult> {
  const connection = await db.connection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new Error('Connection not found');

  const password = connection.password ? decrypt(connection.password) : null;
  const privateKey = connection.privateKey ? decrypt(connection.privateKey) : null;
  const passphrase = connection.passphrase ? decrypt(connection.passphrase) : null;

  let client: Client | null = null;
  try {
    client = await connectForCommand(
      connection.host, connection.port, connection.username,
      connection.authType, password, privateKey, passphrase
    );

    const detectOs = connection.osType || '';
    const cmd = getUpdateCheckCommand(detectOs);
    const result = await execSSH(client, cmd);

    const packageList = result.success
      ? result.stdout.split('\n').filter((l) => l.trim()).slice(0, 50)
      : [];

    return {
      packageCount: packageList.length,
      packageList,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    if (client) {
      try { client.end(); } catch (e) {}
    }
  }
}

export async function installUpdates(connectionId: string): Promise<CommandResult> {
  const connection = await db.connection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new Error('Connection not found');

  const password = connection.password ? decrypt(connection.password) : null;
  const privateKey = connection.privateKey ? decrypt(connection.privateKey) : null;
  const passphrase = connection.passphrase ? decrypt(connection.passphrase) : null;

  let client: Client | null = null;
  try {
    client = await connectForCommand(
      connection.host, connection.port, connection.username,
      connection.authType, password, privateKey, passphrase
    );

    const detectOs = connection.osType || '';
    const cmd = getUpdateInstallCommand(detectOs);
    return await execSSH(client, cmd);
  } finally {
    if (client) {
      try { client.end(); } catch (e) {}
    }
  }
}

export async function rebootSystem(connectionId: string): Promise<CommandResult> {
  const connection = await db.connection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new Error('Connection not found');

  const password = connection.password ? decrypt(connection.password) : null;
  const privateKey = connection.privateKey ? decrypt(connection.privateKey) : null;
  const passphrase = connection.passphrase ? decrypt(connection.passphrase) : null;

  let client: Client | null = null;
  try {
    client = await connectForCommand(
      connection.host, connection.port, connection.username,
      connection.authType, password, privateKey, passphrase
    );

    return await execSSH(client, 'sudo reboot 2>&1 &');
  } finally {
    if (client) {
      try { client.end(); } catch (e) {}
    }
  }
}

function getUpdateCheckCommand(osType: string): string {
  const os = osType.toLowerCase();
  if (os.includes('debian') || os.includes('ubuntu') || os.includes('mint')) {
    return 'apt list --upgradable 2>/dev/null | tail -n +2';
  }
  if (os.includes('rhel') || os.includes('centos') || os.includes('fedora') || os.includes('alma') || os.includes('rocky')) {
    return 'dnf check-update -q 2>/dev/null || yum check-update -q 2>/dev/null';
  }
  if (os.includes('arch') || os.includes('manjaro')) {
    return 'checkupdates 2>/dev/null || pacman -Qu 2>/dev/null';
  }
  if (os.includes('alpine')) {
    return 'apk version -l \'<\' 2>/dev/null | head -50';
  }
  if (os.includes('opensuse') || os.includes('suse')) {
    return 'zypper list-updates 2>/dev/null | tail -n +4';
  }
  return 'apt list --upgradable 2>/dev/null | tail -n +2 || dnf check-update -q 2>/dev/null || pacman -Qu 2>/dev/null';
}

function getUpdateInstallCommand(osType: string): string {
  const os = osType.toLowerCase();
  if (os.includes('debian') || os.includes('ubuntu') || os.includes('mint')) {
    return 'sudo DEBIAN_FRONTEND=noninteractive apt-get update && sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y 2>&1';
  }
  if (os.includes('rhel') || os.includes('centos') || os.includes('fedora') || os.includes('alma') || os.includes('rocky')) {
    return 'sudo dnf upgrade -y 2>&1 || sudo yum upgrade -y 2>&1';
  }
  if (os.includes('arch') || os.includes('manjaro')) {
    return 'sudo pacman -Syu --noconfirm 2>&1';
  }
  if (os.includes('alpine')) {
    return 'sudo apk upgrade 2>&1';
  }
  if (os.includes('opensuse') || os.includes('suse')) {
    return 'sudo zypper update -y 2>&1';
  }
  return 'sudo apt-get update && sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y 2>&1';
}
