import { Client } from 'ssh2';

interface SSHConnectOptions {
  host: string;
  port: number;
  username: string;
  authType: 'PASSWORD' | 'KEY';
  password?: string | null;
  privateKey?: string | null;
  passphrase?: string | null;
  rows?: number;
  cols?: number;
}

/**
 * Factory function establishing a secure SSH connection.
 * Resolves with an active ssh2 Client instance once handshaking completes.
 */
export function connectSSH(options: SSHConnectOptions): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn.on('ready', () => {
      resolve(conn);
    });

    conn.on('error', (err) => {
      reject(err);
    });

    // Configure connection settings
    const config: any = {
      host: options.host,
      port: options.port || 22,
      username: options.username,
      readyTimeout: 10000, // 10s connection handshaking limit
      keepaliveInterval: 10000, // Send keepalive every 10s to prevent NAT/firewall timeouts
      keepaliveCountMax: 3, // Disconnect after 3 consecutive missed keepalives (30s)
    };

    if (options.authType === 'PASSWORD') {
      if (!options.password) {
        return reject(new Error('Password is required for password SSH authentication.'));
      }
      config.password = options.password;
    } else {
      if (!options.privateKey) {
        return reject(new Error('Private Key is required for key SSH authentication.'));
      }
      config.privateKey = options.privateKey;
      if (options.passphrase) {
        config.passphrase = options.passphrase;
      }
    }

    try {
      conn.connect(config);
    } catch (err) {
      reject(err);
    }
  });
}
