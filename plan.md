# Pillar — Implementation Plan

## Project Overview
Pillar is a self-hosted, responsive, and secure web-based remote-access gateway for homelabs. It enables starting secure browser-based SSH sessions, and is designed for future extension with VNC, RDP, and Proxmox API integration.

## Tech Stack
- **Frontend**: Next.js 15+ (App Router), React 19, TypeScript
- **Styling**: Next.js CSS Modules (`*.module.css`) + CSS Custom Properties in `globals.css` (NO Tailwind CSS)
- **Backend & WS Bridge**: Custom Express.js server initializing Next.js and hosting the WebSocket server for real-time duplex streaming to `ssh2` sessions.
- **Database**: SQLite managed via Prisma ORM (`connection_limit=1` in WAL mode)
- **Encryption**: AES-256-GCM via Node `crypto` using `ENCRYPTION_KEY` hex env var (min 32 bytes)
- **Auth**: NextAuth.js v5 (JWT strategy, credential provider + TOTP verification step)

---

## Roadmap & Features

### Phase 1: Project Setup & DB Schema
- [ ] Initialize Next.js 15+ standalone build config with TypeScript
- [ ] Configure custom Express server entry (`server.ts`) with `ws` upgrade handling
- [ ] Prisma SQLite configuration with `connection_limit=1` for WAL mode safety
- [ ] Define database models:
  - `User` (id, email, name, username, role, passwordHash, avatarUrl, mfaSecret [encrypted], mfaEnabled, mfaEnforced, createdAt, updatedAt)
  - `Connection` (id, userId, name, host, port, username, authType, password [encrypted], privateKey [encrypted], passphrase [encrypted], isShared, createdAt, updatedAt)
  - `SharedConnection` (connectionId, userId) join table for user-level connection sharing
  - `AuditLog` (id, userId, event, ip, meta [JSON], createdAt)
- [ ] Code encryption helpers (`lib/crypto.ts`) implementing AES-256-GCM
- [ ] Database client singleton (`lib/db.ts`) cached on `globalThis` in development

### Phase 2: Themes & Localization Base
- [ ] Create `styles/globals.css` with CSS custom variables for themes: Dracula, Nord, Cyberpunk, GitHub (light + dark versions each = 8 palettes total)
- [ ] Load and verify 10 Google Font monospace coding fonts:
  - JetBrains Mono (default), Fira Code, Source Code Pro, Inconsolata, Roboto Mono, Cascadia Code, Ubuntu Mono, IBM Plex Mono, Anonymous Pro, and SF Mono (system fallback)
- [ ] ThemeProvider implementation (Context syncing `data-theme` attribute on `<html>`)
- [ ] Date/Time formatting and localization helper (`lib/datetime.ts`) supporting IANA timezones, EU/US/ISO formats, and 12h/24h clocks

### Phase 3: Secure Authentication, MFA & Onboarding
- [ ] Implement NextAuth.js v5 configuration with CredentialsProvider and custom JWT claims (role, mfaEnabled, mfaVerified)
- [ ] Route middleware checks (`middleware.ts`) guarding app vs login routes
- [ ] Onboarding `/setup` wizard page: visible only if 0 users exist in DB, creates first ADMIN account
- [ ] Credentials login flow with dynamic sub-step for TOTP challenge if MFA enabled
- [ ] MFA enrollment via `/settings` (TOTP generation with otplib, encrypted database persistence, QR code renderer)
- [ ] Admin MFA Override capability (resetting or disabling a user's MFA)

### Phase 4: WebSocket SSH Tunneling Server
- [ ] Connect `ws.Server` upgrade hook in Express (`server.ts`)
- [ ] WS session authentication: validate NextAuth JWT from cookie or authorization header
- [ ] SSH2 connection factory (`lib/ssh.ts`): loads Connection records, decrypts passwords/private keys at runtime, and establishes stream
- [ ] Duplex socket stream pipeline: forward browser keystrokes to SSH PTY stdin; pipe SSH stdout to WebSocket client
- [ ] Handle terminal resize messages: `{ type: "resize", cols: number, rows: number }`
- [ ] Handle error states, unexpected client disconnects, and gracefully close SSH streams (writing audit log records)

### Phase 5: Responsive Layouts & Core UI
- [ ] CSS Modules for layout blocks: Sidebar, Header, Page layout
- [ ] Build shared visual components: Button, Input, Select, Modal, Badge, Card, Table, Toast, Tooltip, Spinner (zero Tailwind)
- [ ] Terminal page (`/connections/[id]`): imports `xterm.js` and `xterm-addon-fit` as a Client Component, coordinates with WebSocket handler
- [ ] Dashboard screen (`/dashboard`): displays metrics, recent session cards, connection catalog lists
- [ ] Profile Settings tab-page (`/settings`):
  - Profile Sub-Form: avatar upload (saved to `/public/uploads/avatars` with custom filename timestamps), display name, username, email
  - Security Sub-Form: Password update, MFA enrollment
  - Preference Sub-Form: Monospace font selector (modifies `--terminal-font`), clock toggle (12h vs 24h), date preference (EU/US/ISO), timezone selector (IANA)

### Phase 6: Built-in User & API Documentation Portals
- [ ] Create repository-bundled Markdown guide documents in `docs/content/`
- [ ] Server component page `/docs/[[...slug]]` parsing markdown files dynamically via rehype/remark with beautiful CSS-scoping
- [ ] Interactive custom API explorer `/apidocs` rendering routes with color-coded HTTP methods, collapsible JSON request/response schema previews, and active testing controls

### Phase 7: Dedicated Admin Console
- [ ] System Diagnostics API (`/api/admin/metrics`): polls host CPU load average, memory usage, and counts active WebSocket sessions
- [ ] User CRUD operations, user suspension state toggles, and MFA reset commands
- [ ] Advanced audit logs table screen (`/admin/audit`): lists paginated database audit events with search filters and timezone-aware local rendering

### Phase 8: Dual-Deployment Configuration
- [ ] Optimize multi-stage `Dockerfile` with non-root runtime users and standalone build bundling
- [ ] `docker-compose.yml` defining database volume storage and application variables
- [ ] native `pillar.service` template for systemd bare-metal configurations

---

## Roadmap Enhancements

### Phase 9: VNC Client Remote Desktop
- [ ] Node.js RFB (VNC) proxy backend built on Express using a WebSocket to TCP stream bridge
- [ ] Client interface utilizing `novnc` canvas rendering

### Phase 10: RDP Gateway Integration
- [ ] Docker Compose sidecar configurations using Apache Guacamole's daemon (`guacd`)
- [ ] Express proxy gateway connecting browser-side clients to `guacd` sessions

### Phase 11: Proxmox VE API Integration
- [ ] Proxmox token authentication storage
- [ ] Dashboard client reading PVE API nodes and VMs, displaying runtime graphs, and sending start/stop/reboot commands
- [ ] Embed direct VM terminal consoles via Proxmox token-ticket integrations
