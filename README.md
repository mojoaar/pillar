# Pillar

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Sponsor: Buy Me A Coffee](https://img.shields.io/badge/Sponsor-Buy_Me_A_Coffee-orange.svg)](https://www.buymeacoffee.com/mojoaar)

> **Pillar**: The bedrock of your remote connections.

Pillar is a highly secure, beautiful, self-hosted web-based remote-access gateway. Launch secure, low-latency, and custom-themed terminal and desktop sessions directly from any modern web browser.

---

## ✨ Features

- **Web SSH Terminal**: Fully responsive, low-latency terminal sessions backed by `@xterm/xterm` canvas rendering and real-time WebSocket communication.
- **Web VNC Remote Desktop**: Seamless HTML5 browser remote desktop console streams utilizing `@novnc/novnc` canvas renders.
- **Advanced Multi-Theming & Fonts**: Choose from 8 visual themes (Dracula, Nord, Cyberpunk, and GitHub light & dark variations) and select from 10 popular monospace coding fonts, dynamically styled across the entire application interface!
- **Dynamic Spotlight Search**: Trigger the global command search palette with `Cmd+K` (macOS) or `Ctrl+K` (Linux/Windows) to look up connection nodes, swap theme colors, or run navigations on-the-fly.
- **Secrets Encryption at Rest**: Sensitive profile credentials (passwords, private keys, key passphrases, and MFA secrets) are encrypted at-rest using **AES-256-GCM** backed by a secure 32-byte key.
- **Robust MFA Setup**: Integrated credential system with optional or mandatory TOTP Multi-Factor Authentication, including single-use **MFA backup recovery codes** and administrative overrides.
- **Diagnostics & Auditing Dashboard**: View system utilization metrics, manage user accounts (CRUD, inline suspensions, and role changes), and browse permanent, paginated security audit log trails.
- **Built-in Docs Portal & API Spec**: Read locally bundled guides and interactively test REST endpoints using our themed dynamic Swagger-style API explorer without leaving the gateway.

---

## 🛠️ Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Next.js CSS Modules + CSS Custom Properties (Zero Tailwind CSS)
- **Backend Bridge**: Custom Express.js server integrating a WebSocket upgrade and a TCP stream bridge
- **Engines**: `ssh2` (SSH terminal streaming) and raw TCP sockets (VNC desktop streaming)
- **Database**: SQLite managed via Prisma ORM (running in `connection_limit=1` WAL mode)

---

## ⚙️ Quick Start

Check the `docs/content/getting-started.md` directory for comprehensive deployment tutorials, or run:

```bash
# 1. Clone the repository
git clone git@github.com:mojoaar/pillar.git
cd pillar

# 2. Install dependencies
npm install

# 3. Initialize SQLite Database file and sync all schema tables
npm run db:push

# 4. Start development gateway server
npm run dev
```

The gateway server is now running! Open **`http://localhost:3000`** in your browser.

---

## 💎 Credits & External Dependencies

Pillar is made possible by the incredible work of these open-source libraries, modules, and foundations:

- **[Next.js](https://nextjs.org/)** & **[React](https://react.dev/)** — The core full-stack framework and user-interface render engine.
- **[Express](https://expressjs.com/)** — Fast, unopinionated minimalist web server managing custom routing.
- **[Prisma ORM](https://www.prisma.io/)** — Next-generation Node.js and TypeScript ORM managing SQLite.
- **[NextAuth.js v5](https://next-auth.js.org/)** — Battle-tested, secure authentication framework managing credential verification and Edge session tokens.
- **[@xterm/xterm](https://xtermjs.org/)** — Premium browser-side terminal emulator providing GPU-accelerated text rendering.
- **[ssh2](https://github.com/mscdex/ssh2)** — Pure JavaScript client implementation of the SSH2 protocol for Node.js.
- **[@novnc/novnc](https://novnc.com/)** — Standard open-source VNC HTML5 browser client canvas decoder.
- **[otplib](https://github.com/yeojising/otplib)** — Cryptographically secure TOTP (RFC 6238) multi-factor token verification suite.
- **[bcryptjs](https://github.com/dcodeIO/bcrypt.js)** — Highly secure, pure JavaScript implementation of the bcrypt password hashing algorithm.
- **[qrcode](https://github.com/soldair/node-qrcode)** — QR Code visual generator for MFA scanner configurations.
- **[lucide-react](https://lucide.github.io/lucide/)** — Beautiful, consistent, and tree-shakeable community-designed icon kit.

---

## 📝 Changelog

### [0.1.0] - 2026-06-21

- **Core Scaffolding**: Initialized Next.js 16, SQLite schema structures, and custom Express upgrade handshaking tunnels.
- **Unified Branding**: Standardized routing paths, logo labels, and created `admin@pillar.local` unified branding placeholders.
- **Integrated Portals**: Coded the dynamic guides reader and dynamic interactive Swagger-style REST explorer.
- **Security Hardening**:
  - Implemented AES-256-GCM cryptography at-rest.
  - Implemented BOLA scope validation checks (preventing unauthorized connection loading).
  - Added 8 single-use secure **MFA backup recovery codes** (`XXXX-XXXX`) during TOTP configuration.
  - Added sliding-window rate limiters on sensitive auth endpoints.
  - Added HTTP CSP security headers and 5-second connection watchdog timeouts.
  - Prevented storage leaks by deleting orphaned older avatar images.
  - Restored HMR development upgrades by bypassing non-terminal upgrade paths.
- **Interactive Command Palette**: Added Spotlight/Raycast search overlay (`Cmd+K` / `Ctrl+K`) supporting connections catalog searches, navigation actions, visual theme swappers, and font mappers.
- **Real-Time Canvas Re-Theming**: Coded live computed-styles syncing on active terminals upon visual scheme toggles.
- **Persistent Resumable Sockets**: Added global SSH session registry and 5-minute watchdog timers (terminal persists in memory when navigating away).
- **Deployment & Scaling**: Designed Stage-2 non-privileged multi-stage `Dockerfile`, compose volumes, and bare-metal systemd templates.

---

## ⚖️ License

AGPL-3.0 Copyleft License. See [LICENSE](./LICENSE) for details. Developed with ❤️ by `mojoaar`.
