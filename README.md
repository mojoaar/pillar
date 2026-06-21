# Pillar

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Sponsor: Buy Me A Coffee](https://img.shields.io/badge/Sponsor-Buy_Me_A_Coffee-orange.svg)](https://www.buymeacoffee.com/mojoaar)

> **Pillar**: The bedrock of your remote connections.

Pillar is a highly secure, beautiful, self-hosted web-based remote-access gateway. Launch secure, low-latency, and custom-themed terminal and desktop sessions directly from any modern web browser.

---

## ✨ Features

- **Web SSH Terminal**: Fully responsive, low-latency terminal sessions backed by `@xterm/xterm` canvas rendering and real-time WebSocket communication.
- **Web VNC Remote Desktop**: Seamless HTML5 browser remote desktop console streams utilizing `@novnc/novnc` canvas renders.
- **Web RDP Remote Desktop**: Apache Guacamole-backed RDP gateway with zero-dependency protocol handshake and dynamic CDN-loaded client.
- **Proxmox VE Integration**: Real-time cluster node monitoring, VM resource graphs, and one-click connection importing.
- **Extensible Plugins Framework**: Encrypted AES-256-GCM configuration storage. Enable/disable integrations globally from the Admin panel.
- **Personal API Keys**: Generate `pil_live_` bearer tokens with HMAC-SHA256 hashing for programmatic scripting and CLI access.
- **Advanced Multi-Theming & Fonts**: Choose from 8 visual themes (Dracula, Nord, Cyberpunk, and GitHub light & dark variations) and select from 10 popular monospace coding fonts.
- **Dynamic Spotlight Search**: Trigger the global command search palette with `Cmd+K` (macOS) or `Ctrl+K` (Linux/Windows).
- **Collapsible Sidebar**: Toggle the navigation sidebar via `Cmd/Ctrl+B` or the chevron button — state persisted across sessions.
- **Secrets Encryption at Rest**: Sensitive profile credentials encrypted at-rest using **AES-256-GCM** backed by a secure 32-byte hex key.
- **Robust MFA Setup**: TOTP multi-factor authentication with single-use backup recovery codes and administrative overrides.
- **Diagnostics & Auditing Dashboard**: System metrics, user CRUD, inline suspensions, role changes, and paginated security audit logs.
- **Built-in Docs Portal & API Spec**: Locally bundled guides and a dynamic Swagger-style API explorer at `/apidocs`.

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
- **Unified Branding**: Standardized routing paths, logo labels, and branding placeholders.
- **Integrated Portals**: Coded the dynamic guides reader and interactive Swagger-style REST explorer at `/apidocs`.
- **Web VNC Remote Desktop**: Integrated `@novnc/novnc` with raw WebSocket-to-TCP RFB proxy bridge.
- **Web RDP Remote Desktop**: Added Apache Guacamole (`guacd`) Docker sidecar with zero-dependency protocol handshake in `server.ts`.
- **Proxmox VE Plugin**: Extensible plugins framework with encrypted config storage; real-time cluster monitoring, VM resource graphs, and one-click connection importing.
- **Personal API Keys**: `pil_live_` bearer tokens with HMAC-SHA256 hashing, expiration, and instant revocation.
- **Collapsible Sidebar**: `Cmd/Ctrl+B` shortcut plus toggle button; state persisted in localStorage.
- **Optional Domain Name**: Added display-only domain field to connection profiles.
- **Favicon & SEO**: Dracula-themed SVG/ICO/PNG favicons covering all major browsers; Open Graph, Twitter Card, sitemap.xml, and robots.txt.
- **Deployment Guide**: Production guide for Proxmox LXC + Nginx Proxy Manager + Let's Encrypt SSL.
- **Test Suite**: 122 vitest tests across 15 files covering crypto, sessions, auth-helper, API routes, and frontend components.
- **Security Hardening**:
  - AES-256-GCM encryption at-rest with hex-only key enforcement.
  - BOLA scope validation on all connection and profile routes.
  - 8 single-use MFA backup recovery codes with optimistic locking.
  - Sliding-window rate limiters on auth endpoints with periodic sweep.
  - CSP, HSTS, Permissions-Policy, and Cross-Origin-Resource-Policy headers.
  - Origin validation on all WebSocket upgrades (CSWSH protection).
  - SRI integrity hashes on CDN-loaded scripts.
  - Credential attempt rate limiting (5 per email per 15 min).
  - Unified "Invalid credentials" error messages to prevent user enumeration.
  - WebSocket pre-upgrade authentication (401 rejected before handshake).
  - `globalThis` helpers migrated to `sessionRegistry` module exports.
  - TCP port range and connection field length validation.
- **Interactive Command Palette**: Spotlight/Raycast search overlay (`Cmd+K` / `Ctrl+K`) with connections, themes, fonts, and navigation.
- **Real-Time Canvas Re-Theming**: Live computed-styles syncing on active terminals upon visual scheme toggles.
- **Persistent Resumable Sockets**: SSH session registry with 5-minute watchdog timers and self-healing reconnect-on-any-key.
- **Deployment & Scaling**: Multi-stage non-privileged `Dockerfile`, compose volumes, bare-metal systemd templates.

---

## ⚖️ License

AGPL-3.0 Copyleft License. See [LICENSE](./LICENSE) for details. Developed with ❤️ by `mojoaar`.
