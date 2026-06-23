# Pillar — Implementation Plan (Completed)

## Project Overview
Pillar is a self-hosted, responsive, and secure web-based remote-access gateway for homelabs. It enables starting secure browser-based SSH sessions, and is designed for future extension with VNC and Proxmox API integration.

## Tech Stack
- **Frontend**: Next.js 15+ (App Router), React 19, TypeScript
- **Styling**: Next.js CSS Modules (`*.module.css`) + CSS Custom Properties in `globals.css` (NO Tailwind CSS)
- **Backend & WS Bridge**: Custom Express.js server initializing Next.js and hosting the WebSocket server for real-time duplex streaming to `ssh2` sessions.
- **Database**: SQLite managed via Prisma ORM (Prisma v7 driver adapter, no `connection_limit` needed)
- **Encryption**: AES-256-GCM via Node `crypto` using `ENCRYPTION_KEY` hex env var (min 32 bytes)
- **Auth**: NextAuth.js v5 (JWT strategy, credential provider + TOTP verification step)

---

## Roadmap & Features

### Phase 1: Project Setup & DB Schema
- [x] Initialize Next.js 15+ standalone build config with TypeScript
- [x] Configure custom Express server entry (`server.ts`) with `ws` upgrade handling
- [x] Prisma SQLite configuration with WAL mode (v6: `connection_limit=1`; v7: driver adapter, no query params)
- [x] Define database models:
  - `User` (id, email, name, username, role, passwordHash, avatarUrl, mfaSecret [encrypted], mfaEnabled, mfaEnforced, createdAt, updatedAt)
   - `Connection` (id, userId, name, host, domain, port, protocol, tags, username, authType, password [encrypted], privateKey [encrypted], passphrase [encrypted], isShared, ignoreCert, allowRemoteExec, osType, pollIntervalMin, createdAt, updatedAt)
  - `SharedConnection` (connectionId, userId) join table for user-level connection sharing
  - `AuditLog` (id, userId, event, ip, meta [JSON], createdAt)
- [x] Code encryption helpers (`lib/crypto.ts`) implementing AES-256-GCM
- [x] Database client singleton (`lib/db.ts`) cached on `globalThis` in development

### Phase 2: Themes & Localization Base
- [x] Create `styles/globals.css` with CSS custom variables for themes: Dracula, Nord, Cyberpunk, GitHub (light + dark versions each = 8 palettes total)
- [x] Load and verify 10 Google Font monospace coding fonts:
  - JetBrains Mono (default), Fira Code, Source Code Pro, Inconsolata, Roboto Mono, Cascadia Code, Ubuntu Mono, IBM Plex Mono, Anonymous Pro, and SF Mono (system fallback)
- [x] ThemeProvider implementation (Context syncing `data-theme` attribute on `<html>`)
- [x] Date/Time formatting and localization helper (`lib/datetime.ts`) supporting IANA timezones, EU/US/ISO formats, and 12h/24h clocks

### Phase 3: Secure Authentication, MFA & Onboarding
- [x] Implement NextAuth.js v5 configuration with CredentialsProvider and custom JWT claims (role, mfaEnabled, mfaVerified)
- [x] Route middleware checks (`middleware.ts`) guarding app vs login routes
- [x] Onboarding `/setup` wizard page: visible only if 0 users exist in DB, creates first ADMIN account
- [x] Credentials login flow with dynamic sub-step for TOTP challenge if MFA enabled
- [x] MFA enrollment via `/settings` (TOTP generation with otplib, encrypted database persistence, QR code renderer)
- [x] Admin MFA Override capability (resetting or disabling a user's MFA)

### Phase 4: WebSocket SSH Tunneling Server
- [x] Connect `ws.Server` upgrade hook in Express (`server.ts`)
- [x] WS session authentication: validate NextAuth JWT from cookie or authorization header
- [x] SSH2 connection factory (`lib/ssh.ts`): loads Connection records, decrypts passwords/private keys at runtime, and establishes stream
- [x] Duplex socket stream pipeline: forward browser keystrokes to SSH PTY stdin; pipe SSH stdout to WebSocket client
- [x] Handle terminal resize messages: `{ type: "resize", cols: number, rows: number }`
- [x] Handle error states, unexpected client disconnects, and gracefully close SSH streams (writing audit log records)

### Phase 5: Responsive Layouts & Core UI
- [x] CSS Modules for layout blocks: Sidebar, Header, Page layout
- [x] Build shared visual components: Button, Input, Select, Modal, Badge, Card, Table, Toast, Tooltip, Spinner (zero Tailwind)
- [x] Terminal page (`/connections/[id]`): imports `xterm.js` and `xterm-addon-fit` as a Client Component, coordinates with WebSocket handler
- [x] Dashboard screen (`/dashboard`): displays metrics, recent session cards, connection catalog lists
- [x] Profile Settings tab-page (`/settings`):
  - Profile Sub-Form: avatar upload (saved to `/public/uploads/avatars` with custom filename timestamps), display name, username, email
  - Security Sub-Form: Password update, MFA enrollment
  - Preference Sub-Form: Monospace font selector (modifies `--terminal-font`), clock toggle (12h vs 24h), date preference (EU/US/ISO), timezone selector (IANA)

### Phase 6: Built-in User & API Documentation Portals
- [x] Create repository-bundled Markdown guide documents in `docs/content/`
- [x] Server component page `/docs/[[...slug]]` parsing markdown files dynamically via rehype/remark with beautiful CSS-scoping
- [x] Interactive custom API explorer `/apidocs` rendering routes with color-coded HTTP methods, collapsible JSON request/response schema previews, and active testing controls

### Phase 7: Dedicated Admin Panel
- [x] System Diagnostics API (`/api/admin/metrics`): polls host CPU load average, memory usage, and counts active WebSocket sessions
- [x] User CRUD operations, user suspension state toggles, and MFA reset commands
- [x] Advanced audit logs table screen (`/admin/audit`): lists paginated database audit events with search filters and timezone-aware local rendering

### Phase 8: Dual-Deployment Configuration
- [x] Optimize multi-stage `Dockerfile` with non-root runtime users and standalone build bundling
- [x] `docker-compose.yml` defining database volume storage and application variables
- [x] native `pillar.service` template for systemd bare-metal configurations

---

## Roadmap Enhancements (Backlog)

### Phase 9: VNC Client Remote Desktop
- [x] Node.js RFB (VNC) proxy backend built on Express using a WebSocket to TCP stream bridge
- [x] Client interface utilizing `@novnc/novnc` canvas rendering


### Phase 11: Proxmox VE API Integration
- [x] Proxmox token authentication storage
- [x] Dashboard client reading PVE API nodes and VMs, displaying runtime graphs, and providing one-click import as Connection profiles
- [x] Secure read-only permissions and inventory mapping

### Phase 12: Advanced Automations & Diagnostics
- [ ] 1-Click Saved Maintenance Scripts & Automation Engine
- [ ] Live Latency Ping Diagnostics & TCP Host Port Status Checkers
- [x] Personal API Keys Management & Token Bearer Authentication API

### Phase 13: Native CLI Client (Go)
- [ ] Interactive login flow with MFA/TOTP challenge support
- [ ] List saved connection profiles from the gateway
- [ ] Launch interactive SSH sessions through Pillar's WebSocket tunnel
- [ ] Terminal raw mode, resize signals, and PTY pipe management

### Phase 14: Remote System Management & Update Orchestrator (Plugin)
- [x] `allowRemoteExec` Boolean field on Connection model (opt-in per-connection)
- [x] Plugin registration: `systems` plugin toggle in Admin → Manage Plugins
- [x] Auto-detection of remote OS via `cat /etc/os-release` with user-override per-connection
- [x] `/systems` dashboard page: per-server OS, uptime, pending updates, color-coded status
- [x] Configurable auto-poll interval (default 1 hour, per-connection override)
- [x] Update install command dispatch with confirm modals and audit logging
- [x] Reboot command dispatch with confirm, audit logging, and post-reboot uptime verification
- [x] Post-reboot tracking: "rebooting..." status → auto-reconnect → verify uptime changed
- [x] Role-based access: ADMIN always authorized; USER requires `systems` in allowedPlugins
- [x] Remote Exec fields in connection form UI (allowRemoteExec toggle, OS override, poll interval) — only shown when Systems plugin is enabled
- [x] API routes updated: GET/POST/PATCH /api/connections accept and return new fields
- [x] User dashboard active sessions widget (table + terminate, polls every 5s)
- [x] Documentation updated in admin-guide.md

---

## Security Remediation Backlog

#### ⚡ Tier 1 — Immediate Priority (CRITICAL)
- [x] Remove hardcoded ENCRYPTION_KEY from test-ssh.ts; throw on missing key in all environments
- [x] Validate callbackUrl is relative path in LoginForm.tsx
- [x] Add Origin header validation to all 4 WebSocket handlers
- [x] Move JWT cookie validation BEFORE wss.handleUpgrade() in upgrade interceptor
- [x] Add SRI integrity hashes to CDN scripts 
- [x] Remove unsafe-eval from CSP; add Strict-Transport-Security header

#### 🟠 Tier 2 — HIGH Severity
- [x] Standardize all auth error messages to generic "Invalid credentials"
- [x] Add optimistic locking to backup code redemption
- [x] Add periodic sweep to clean expired rateLimitBuckets keys
- [x] Add SSH keepalive + TCP keepalive to VNC sockets
- [x] Wrap watchdog cleanup in try/finally to guarantee session delete
- [x] Add try/catch around decodeURIComponent in parseCookies()

#### 🟡 Tier 3 — MEDIUM Severity
- [x] Enforce hex-only ENCRYPTION_KEY; remove SHA-256 derivation fallback
- [x] Add HMAC-SHA256 with server pepper for API key hashing
- [ ] Add tokenVersion to User model; increment on password change; check in JWT
- [x] Increase API key entropy to 256 bits
- [x] Add app.set('trust proxy', 1)
- [ ] Add per-user concurrent session cap
- [x] Return generic errors in Proxmox API; log real errors server-side
- [x] Validate NEXTAUTH_SECRET length >= 32 at startup
- [x] Fix vmid=0 falsy check in Proxmox POST
- [x] Enforce mfaEnforced at login
- [x] Add maxLength validation to connection name/host/username

#### 🟢 Tier 4 — LOW Severity
- [x] Replace NEXTAUTH_SECRET! non-null assertions with runtime guards
- [x] Add rate limiting on credential attempts (5 per email per 15 min)
- [x] Explicitly set TOTP window: 1
- [x] Throw on null/undefined input to encrypt()/decrypt()
- [x] Log only err.message in production
- [x] Clamp audit log pagination limit to max 100
- [x] Move globalThis helpers to module exports (lib/sessions.ts)
- [x] Add TCP port range validation (1-65535)
- [x] Set explicit TOTP window/tolerance
- [x] Add Permissions-Policy + Cross-Origin-Resource-Policy headers
