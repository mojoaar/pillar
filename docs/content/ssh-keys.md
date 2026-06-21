# Configuring SSH Key Authentication

SSH private key authentication is significantly more secure than standard password-based authentication. Pillar fully supports storing **PEM-formatted private keys** (with optional passphrases) to establish secure SSH sessions.

---

## 🔑 1. Generate an SSH Key Pair

We recommend generating an **Ed25519** key pair, which is highly secure, lightweight, and modern. Run this command on your workstation or remote target:

```bash
ssh-keygen -t ed25519 -C "pillar-gateway"
```

You will be asked:
1. **Enter file in which to save the key**: Press Enter to use the default path (e.g. `~/.ssh/id_ed25519`), or choose a custom name.
2. **Enter passphrase**: Enter a secure passphrase if you want to encrypt the private key file, or leave blank for passwordless keys.

This command generates two files:
- `~/.ssh/id_ed25519` (Your **Private Key** - keep this absolutely secret!)
- `~/.ssh/id_ed25519.pub` (Your **Public Key** - this is copied to host targets)

---

## 📤 2. Add Public Key to Host Nodes

To authorize Pillar to sign into your local nodes, copy your newly generated **Public Key** (`.pub`) onto the host target. The easiest way is using `ssh-copy-id`:

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub username@192.168.1.50
```

Alternatively, you can manually append the public key line into the host target's `authorized_keys` file:

```bash
# On the remote node:
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5..." >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

---

## 💾 3. Save Private Key in Pillar

Once your public key is authorized on the remote host, you can register the connection in Pillar:

1. Open **Connections** inside your Pillar sidebar and click **New Connection**.
2. Enter the Name, Host IP, Port, and Username.
3. Under **Authentication**, select **Private Key**.
4. Open your local private key file (e.g. `~/.ssh/id_ed25519`), copy the *entire block* (including headers like `-----BEGIN OPENSSH PRIVATE KEY-----`), and paste it into the **Private Key** textarea box.
5. If you chose a passphrase when generating the key pair, enter it inside the **Key Passphrase** box.
6. Click **Create SSH Profile**.

---

## 🛡️ Security Profile at Rest

When you save the connection profile:
- Your private key and passphrase are encrypted on the server using **AES-256-GCM** before database insertion, using your custom `ENCRYPTION_KEY`.
- The key is decrypted **only in-memory at connection runtime** inside the WebSocket upgrade thread, and is immediately purged upon handshake completion. It is never logged or exposed.
