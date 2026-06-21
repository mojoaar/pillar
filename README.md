# Pillar

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Sponsor: Buy Me A Coffee](https://img.shields.io/badge/Sponsor-Buy_Me_A_Coffee-orange.svg)](https://www.buymeacoffee.com/mojoaar)

> **Pillar**: The bedrock of your home network.

Pillar is a self-hosted, highly secure, beautiful web-based remote-access gateway for your homelab. Launch secure, low-latency, and custom-themed SSH terminal sessions directly from any modern web browser.

---

## ✨ Features

- **Web SSH Terminal**: Fully responsive terminal sessions backed by `xterm.js` and real-time WebSocket communication.
- **Advanced Multi-Theming & Fonts**: Load out 8 built-in themes (Dracula, Nord, Cyberpunk, GitHub in light & dark variants) and select from 10 popular monospace coding fonts.
- **Dual-Authentication SSH Handlers**: Save SSH connection profiles with either encrypted password-based logins or secure PEM private keys (with passphrases).
- **Security First**: Sensitive credentials (passwords, private keys, MFA keys) are encrypted at-rest using AES-256-GCM.
- **Robust MFA Setup**: Standard login credential system with mandatory or optional TOTP Multi-Factor Authentication.
- **Admin Dashboard**: View system utilization metrics (CPU, Memory, uptime), audit system logs, and manage user accounts with MFA reset commands.
- **Built-in Docs Portal & API Reference**: Read locally bundled guide manuals and view dynamic interactive REST API layouts without leaving the app.

---

## 🛠️ Stack

- **Frontend**: Next.js 15+ (App Router), React 19, TypeScript
- **Styling**: Next.js CSS Modules + CSS custom variables (Zero Tailwind CSS)
- **Backend Bridge**: Custom Express.js server incorporating an attached WebSocket (`ws`) upgrade handler
- **SSH Engine**: `ssh2` duplex streaming bridge
- **Database**: SQLite backed by Prisma ORM (running in WAL mode)

---

## ⚙️ Quick Start

Check the `docs/content/getting-started.md` directory for comprehensive deployment tutorials, or run:

```bash
# Clone the repository
git clone git@github.com:mojoaar/pillar.git
cd pillar

# Install dependencies
npm install

# Push database schema
npm run db:push

# Run development server
npm run dev
```

---

## ⚖️ License

AGPL-3.0 Copyleft License. See [LICENSE](./LICENSE) for details. Developed with ❤️ by `mojoaar`.
