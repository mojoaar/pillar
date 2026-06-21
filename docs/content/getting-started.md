# Getting Started with Pillar

Welcome to **Pillar**, the bedrock of your home network remote access. This guide will walk you through the core concepts, requirements, and steps to get your self-hosted remote-access gateway running securely.

---

## 🚀 Core Architecture

Pillar acts as a secured duplex bridge between your web browser and your local home network nodes (such as Raspberry Pis, Proxmox hypervisors, NAS drives, or Linux clusters). 

```
┌─────────────────┐       HTTPS       ┌─────────────────┐       Local SSH       ┌─────────────────┐
│   Web Browser   │ <───────────────> │  Pillar Gateway │ <───────────────────> │  Homelab Node   │
│   (xterm.js)    │     WebSockets    │ (Express + Node)│       TCP :22         │  (Linux / PVE)  │
└─────────────────┘                   └─────────────────┘                       └─────────────────┘
```

Every connection request undergoes strict **ownership and sharing validation scopes** on the gateway before the SSH handshaking begins, completely preventing any unauthorized proxy requests.

---

## 📋 System Requirements

To host Pillar inside your homelab, ensure your hosting environment matches these criteria:

1. **Runtime Node.js**: Node.js v26.3.0 (Recommended LTS-current)
2. **Database Engine**: SQLite (Prisma ORM automatically handles creation and migrations)
3. **Hardware specs**: Minimum 512MB RAM and 1 CPU core (very lightweight)
4. **Network connectivity**: Access to TCP port `22` on host targets

---

## 📦 Local Installation

To run Pillar bare-metal on your server, follow this quick installation sequence:

```bash
# 1. Clone the repository
git clone git@github.com:mojoaar/pillar.git
cd pillar

# 2. Install dependencies
npm install

# 3. Configure environment parameters
cp .env.example .env
# Edit .env with your custom credentials and ENCRYPTION_KEY

# 4. Initialize database schema
npm run db:push

# 5. Compile and start production server
npm run build
npm start
```

---

## 🔐 First-Run Configuration

On your very first visit to the Pillar gateway website (e.g. `http://localhost:3000`), the application will detect an empty database and automatically route you to the **Interactive Setup Wizard** (`/setup`).

1. Enter your display name and email address.
2. Choose a secure username (e.g. `admin`).
3. Enter an administrative password (minimum 8 characters).
4. Click **Create Admin Account** to finalize initialization.

Once created, the setup wizard shuts down permanently to secure the system, and subsequent visitors are routed directly to the Login page.

---

## ⌨️ Keyboard Shortcuts & Interactive Terminal Features

Pillar includes advanced, modifier-independent global shortcuts and local terminal clipboard interactivity engines to provide a lightning-fast, desktop-native user experience.

### 🔍 Spotlight Command Palette
- **Trigger Chord**: Press **`Cmd+K`** (on macOS) or **`Ctrl+K`** (on Windows/Linux) globally on any page.
- **Actions Available**:
  - Instantly search through your connections catalog.
  - Teleport to different navigation tabs (Dashboard, Connections, Settings, Documentation, API Reference, Proxmox Console).
  - Hot-swap between all **8 client color themes** and **10 monospace coding fonts** on-the-fly.

### 📋 Terminal Interactivity & Clipboard Overrides
Inside the **SSH Web Terminal**:
- **Automatic Copy**: Highlight any text within the terminal window to **automatically copy** it to your system clipboard (no shortcuts required!).
- **Paste Intercept Overrides**:
  - Press **`Cmd+V`** (macOS) or **`Ctrl+V`** (Windows/Linux) to instantly paste your system clipboard content directly into the active prompt.
  - Standard browser context right-click pastes are also fully intercepted and channeled cleanly.

### 🔄 Self-Healing Session Handshakes
- If a connection is terminated due to network lag, server restarts, or target host dropouts, the terminal viewport catches the drop and displays: `[Pillar Gateway] Press ANY key to attempt reconnection...`.
- Simply **press any key** to instantly trigger a self-healing handshake and reconnect!

---

## 📚 Next Steps

- Learn [how to generate and add SSH Keys](/docs/ssh-keys) for secure key-based logins.
- Configure [Multi-Factor Authentication (MFA)](/docs/mfa-setup) on your account.
- Review the [Administration Manual](/docs/admin-guide) for details on metrics, audits, and user management.
- Follow the [Production Deployment Guide](/docs/deployment) for Proxmox, Nginx Proxy Manager, and Docker setups.
