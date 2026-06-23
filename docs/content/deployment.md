# Deploying Pillar on Proxmox VE with Nginx Proxy Manager

This step-by-step guide walks you through deploying Pillar — the self-hosted, secure web-based remote-access gateway — behind Nginx Proxy Manager on a Proxmox VE host. By the end, you'll have SSH and VNC remote bridges running inside a Debian 12 LXC container, served over HTTPS with automatic SSL certificate renewal.

Two deployment options are provided:
- **Option A: Nginx Proxy Manager + Native Node.js** — Bare-metal Node.js, no Docker overhead, direct process control via systemd.
- **Option B: Docker Compose** — All services containerized.

---

## Architecture

```
  Internet
     │
     ▼
  Nginx Proxy Manager  (your existing NPM — handles TLS + routing)
     │                    https://pillar.yourdomain.com
     ▼
  Proxmox LXC Container (Debian 12)  ──  /opt/pillar
  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Node.js 22 LTS (Express + ws)    :3000        │  │
  │  │  - Next.js 16 App Router + API                  │  │
  │  │  - WebSocket SSH / VNC tunnel bridge     │  │
  │  │  - NextAuth v5 (JWT + TOTP MFA)                │  │
  │  └──────────────────┬─────────────────────────────┘  │
  │                     │                                │
  │  ┌──────────────────▼─────────────────────────────┐  │
  │  │  SQLite (Prisma ORM)  :file:/app/data/pillar.db│  │
  │  │  - Users, Connections, AuditLogs, Plugins      │  │
  │  │  - Encrypted at rest (AES-256-GCM)             │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  └──────────────────────────────────────────────────────┘
```

---

## Prerequisites

- A Proxmox VE host (7.0+) with at least 1 GB free RAM and 8 GB free storage
- Nginx Proxy Manager already deployed and reachable on your network
- A domain or subdomain pointing to your NPM instance (e.g., `pillar.yourdomain.com`)
- 15 minutes

---

## Step 1 — Create the Proxmox LXC Container

### Option A: Proxmox Web GUI

1. Open the Proxmox web UI → **Create CT**
2. **General:** Hostname `pillar`, password `<pick a secure root password>`
3. **Template:** `debian-12-standard` (download if not cached)
4. **Root Disk:** 8 GB on `local-lvm` (Pillar is very lightweight — SQLite eats almost no disk)
5. **CPU:** 2 cores
6. **Memory:** 1024 MB, Swap: 512 MB
7. **Network:** `vmbr0`, DHCP (or set a static IP), firewall enabled
8. **DNS:** Use host settings
9. **Confirm:** Check the **Nesting** box under Features (required for Node.js native module compilation)
10. Start the container

### Option B: Proxmox Shell (CLI)

```bash
# Download template if missing
pveam update
pveam download local debian-12-standard_12.2-1_amd64.tar.zst

# Create container (adjust bridge name and storage to match your host)
pct create 250 local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
  --hostname pillar \
  --cores 2 \
  --memory 1024 \
  --swap 512 \
  --storage local-lvm \
  --rootfs local-lvm:8 \
  --net0 name=eth0,bridge=vmbr0,firewall=1,ip=dhcp \
  --ostype debian \
  --features nesting=1 \
  --unprivileged 1 \
  --password '<your-secure-password>'

# Start
pct start 250
```

### Connect to the container

```bash
pct enter 250
```

Or SSH from your workstation:

```bash
ssh root@<container-ip>
```

---

## Step 2 — Base OS Setup & Create Service User

Once inside the container (as root), update packages and create a dedicated non-root service account. Running the gateway as `root` is a security risk — we create a `pillar` system user.

```bash
apt update && apt upgrade -y

# Install sudo if not present (minimal LXC templates may lack it)
apt install -y sudo

# Create a dedicated service user
adduser --system --shell /bin/bash --group --disabled-password --home /opt/pillar pillar

# Grant sudo access for service management
usermod -aG sudo pillar
echo "pillar ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/pillar
chmod 440 /etc/sudoers.d/pillar
```

---

## Step 3 — Install Runtime Dependencies

### Option A: Native Node.js (recommended for small footprint)

Pillar runs natively on Node.js with zero containers. Install Node.js 22 LTS: (or newer) and compile toolchains:

```bash
# Install base tools and C++ compiler (required for bcryptjs and ssh2 native bindings)
apt install -y curl git ca-certificates gnupg build-essential python3

# Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs

# Verify
node --version     # should be v22.x or newer
npm --version      # should be 10.x or newer
```

### Option B: Docker Compose (skip if going native)

Install Docker and Docker Compose v2:

```bash
apt install -y docker.io docker-compose-v2 git curl ca-certificates gnupg

systemctl enable --now docker

# Verify
docker --version
docker compose version
```

---

## Step 4 — Clone the Repository & Install Dependencies

```bash
# Transfer ownership of the app directory
chown -R pillar:pillar /opt/pillar

# Switch to the service user
sudo -u pillar -i
cd /opt/pillar

git clone https://github.com/mojoaar/pillar.git .

# Install all dependencies
npm ci
```

---

## Step 5 — Configure Environment Secrets

Generate strong, cryptographically random secrets for production. These are mandatory — Pillar will refuse to start without them in production mode.

```bash
# Generate secrets (as root or pillar user)
openssl rand -hex 32   # Use this as ENCRYPTION_KEY
openssl rand -base64 48  # Use this as NEXTAUTH_SECRET
```

Create `/opt/pillar/.env`:

```bash
cat > /opt/pillar/.env << 'ENVEOF'
# Database (SQLite — no external DB server needed)
DATABASE_URL=file:/opt/pillar/data/pillar.db

# Security Secrets (replace with your generated values!)
ENCRYPTION_KEY=your_64_character_hex_key_here
NEXTAUTH_SECRET=your_base64_auth_secret_here

# Public URL (must match your Nginx Proxy Manager host)
NEXTAUTH_URL=https://pillar.yourdomain.com

# Node
NODE_ENV=production
PORT=3000
ENVEOF

# Secure the env file
chmod 600 /opt/pillar/.env
chown pillar:pillar /opt/pillar/.env
```

> Replace `pillar.yourdomain.com` with your actual domain.

### Create data directory

```bash
mkdir -p /opt/pillar/data
chown -R pillar:pillar /opt/pillar/data
```

---

## Step 6 — Initialize Database

Create the SQLite database and all tables before building (the build process needs the database for static page generation):

```bash
# As the pillar user
cd /opt/pillar

npm run db:push
```

This creates `/opt/pillar/data/pillar.db` with the full schema (Users, Connections, Plugins, ApiKeys, AuditLogs).

---

## Step 7 — Build & Compile

```bash
npm run build
```

This generates the Prisma client, compiles Next.js, Type-checks the project, and produces the compiled Express gateway server at `dist/server.js`.

> **Troubleshooting:** If the build fails with memory errors, temporarily increase the LXC's RAM to 2048 MB, run the build, then reduce back to 1024 MB.

---

## Step 8 — Create the systemd Service

Create a systemd unit file so Pillar starts automatically on boot and restarts if it crashes:

```bash
# As root (exit the pillar user shell first, or use sudo)
exit  # if still in pillar user's shell

cat > /etc/systemd/system/pillar.service << 'UNITEOF'
[Unit]
Description=Pillar Remote Access Gateway
Documentation=https://github.com/mojoaar/pillar
After=network.target

[Service]
Type=simple
User=pillar
Group=pillar
WorkingDirectory=/opt/pillar
Environment=NODE_ENV=production
EnvironmentFile=/opt/pillar/.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pillar

# Hardening
NoNewPrivileges=yes
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
UNITEOF

# Reload systemd, enable and start
systemctl daemon-reload
systemctl enable pillar
systemctl start pillar

# Verify it is running
systemctl status pillar --no-pager
```

Check the logs to confirm a clean startup:

```bash
journalctl -u pillar -f
```

You should see:
```
🚀 Pillar remote-access gateway running in [production] mode.
👉 http://localhost:3000
```

---

## Step 9 — Configure Nginx Proxy Manager

Now expose Pillar securely through your existing Nginx Proxy Manager instance.

### A. Add Proxy Host

1. Log in to your **Nginx Proxy Manager** web UI (typically at `http://<npm-ip>:81`).
2. Go to **Hosts** → **Proxy Hosts** → **Add Proxy Host**.
3. **Details** tab:
   - **Domain Names**: `pillar.yourdomain.com`
   - **Scheme**: `http`
   - **Forward Hostname / IP**: The LAN IP of your Pillar LXC container (e.g., `192.168.1.250`)
   - **Forward Port**: `3000`
   - **Cache Assets**: Off
   - **Block Common Exploits**: On
   - **Websocket Support**: **On** (this is critical — Pillar uses WebSockets for SSH and VNC tunnels)
4. **SSL** tab:
   - **SSL Certificate**: Request a new certificate via Let's Encrypt
   - **Force SSL**: On
   - **HTTP/2 Support**: On
   - **HSTS Enabled**: On (recommended)
5. Click **Save**.

### C. DNS Record

Ensure your DNS provider (or local DNS server like Pi-hole) has an A record pointing `pillar.yourdomain.com` to your Nginx Proxy Manager's LAN IP.

---

## Step 10 — First-Run Setup & Onboarding

1. Open your browser and navigate to `https://pillar.yourdomain.com`.
2. Pillar detects an empty database and automatically routes you to the **Setup Wizard** (`/setup`).
3. Enter your display name, email address, choose a username (e.g. `admin`), and set a strong administrator password (minimum 8 characters).
4. Click **Create Admin Account**.
5. The setup wizard shuts down permanently — you are now redirected to the login page.
6. Sign in with your new credentials. **Highly recommended:** Immediately navigate to **Settings → Security & MFA** and enroll a TOTP authenticator app.

---

## Step 11 — Verification Checklist

| Test                                                              | Expected Result                                    |
| ----------------------------------------------------------------- | -------------------------------------------------- |
| Open `https://pillar.yourdomain.com`                               | Login screen loads with HTTPS padlock               |
| Sign in with admin credentials                                    | Redirected to Dashboard                            |
| **Settings → Preferences** — switch themes/fonts                   | UI updates instantly without page reload            |
| **Connections** — create a new SSH profile                         | Profile saves and appears in catalog               |
| **Connections** — click **Connect** on a profile                   | xterm.js SSH terminal launches and connects        |
| **Admin Panel → Active Sessions** — inspect badge                  | Shows active session count and details              |
| Press `Ctrl+K` / `Cmd+K` — Spotlight Search                        | Command palette overlay opens with all shortcuts    |

---


---

## Optional: Proxmox VE Integration Plugin

Once logged in, go to **Manage Plugins** in the admin sidebar to configure the optional Proxmox VE integration. See `/docs/admin-guide` inside your deployed Pillar instance for detailed API user, role, and token setup instructions.

---

## Updating Pillar

When new versions are released, update with:

```bash
sudo -u pillar -i
cd /opt/pillar
git pull
npm ci
rm -rf .next dist  # Clean build cache to prevent stale SSR chunks
npm run build
npm run db:push
exit
sudo systemctl restart pillar
```

---

## Firewall Notes

If you run `ufw` or `iptables` on the LXC, ensure port **3000** is accessible from your Nginx Proxy Manager IP:

```bash
ufw allow from 192.168.1.0/24 to any port 3000 proto tcp
```

---

## Troubleshooting

| Symptom                                     | Solution                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ENCRYPTION_KEY is required in production`  | Ensure `.env` contains a valid 64-character hex `ENCRYPTION_KEY`. Use `openssl rand -hex 32` |
| WebSocket connection fails                  | Verify **Websocket Support** is enabled in Nginx Proxy Manager for the proxy host             |
| `npm run build` fails with OOM              | Temporarily increase LXC RAM to 2048 MB, build, then reduce back                             |
| Cannot connect to remote SSH host           | Verify the LXC can reach the target host on the specified port (check firewall rules)         |
| VNC viewer shows blank canvas               | Ensure the `@novnc/novnc` CDN is reachable from the browser; check browser console for errors |
