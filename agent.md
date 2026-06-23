# Pillar — Agent Development Reference

## Runtime Environment
- **Node.js**: v26.3.0. Avoid outdated packages or packages deprecated in modern Node.js runtimes.
- **Database**: SQLite (managed by Prisma ORM v7 with `@prisma/adapter-better-sqlite3`). No `connection_limit` query param needed — the adapter handles pooling internally.

---

## 🚫 STYLING STRICT MANDATE: NO TAILWIND CSS
- **NEVER** use Tailwind utility classes (e.g., `flex`, `p-4`, `text-sm`, `bg-blue-500`) in any component or layout.
- **NEVER** install `tailwindcss`, `@tailwindcss/postcss`, or other tailwind dependencies.
- **CSS Modules only**: Use scoped CSS files (`*.module.css`) placed alongside components (e.g. `Sidebar.tsx` and `Sidebar.module.css`).
- **CSS Custom Properties**: Theme variables and layout globals are declared exclusively in `styles/globals.css`.
- **Theme Selection**: Toggle the `data-theme` attribute on the `<html>` node (e.g. `<html data-theme="dracula-dark">`). Never inject Tailwind dynamic classes for themes.

---

## 🔒 Security Architect Requirements

### 1. Secrets Encryption at Rest
- Sensitive columns: `passwordHash`, `mfaSecret`, `password` (SSH profile), `privateKey` (SSH profile), `passphrase` (SSH profile).
- **NEVER** store these fields in plaintext.
- Encrypt utilizing AES-256-GCM backed by `process.env.ENCRYPTION_KEY` (minimum 32-byte hexadecimal key).
- Read the Connection profile from the DB and decrypt credentials **at connection time only**. Never hold decrypted secrets in persistent global state or logs.

### 2. User Authentication & Roles
- **NextAuth.js v5** JWT Strategy. Include claims `role` (`ADMIN` or `USER`) and `mfaEnabled` inside the session token.
- Secure route validation via `middleware.ts`. Intercept unauthenticated users, routing to `/login` or `/setup`.
- Admin endpoints (`/api/admin/*`) and pages `/admin/*` must strictly verify `session.user.role === 'ADMIN'`. Return HTTP 403 on failure.

### 3. File Upload Safety (Avatars)
- Limit avatar image files to `image/png`, `image/jpeg`, or `image/webp`. Limit file sizes to 2MB maximum.
- Save avatar images to local storage (`/data/uploads/avatars` or `public/uploads/avatars`).
- **Filename cache-busting**: Store using `{userId}_{timestamp}.{ext}` format. Never save with static filenames since browsers aggressively cache image URLs.

### 4. Rate Limiting sliding window
- Auth endpoints: Max 30 attempts per minute.
- Upload endpoints: Max 10 attempts per minute.
- Use a lightweight, in-memory sliding window rate-limiter.

---

## 🚀 Technical Implementation Guidelines & Gotchas

### 1. Next.js 15+ Async API Promises
- Always **`await`** Next.js server-side parameters/headers:
  - `params`
  - `searchParams`
  - `cookies()`
  - `headers()`
- Standard syntax in routes/pages:
  ```typescript
  export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    // ...
  }
  ```

### 2. Standardized API Response Shapes
All REST API routes must match these JSON models:
- **Single resource**: `{ data: { ... } }` or `{ connection: { ... } }`
- **Lists**: `{ data: [ ... ] }` or `{ connections: [ ... ] }`
- **Paginated**: `{ data: [ ... ], total: number, page: number, limit: number }`
- **Error**: `{ error: "Error details" }`

### 3. Database Connection Pooling (SQLite)
- Prisma v7 requires a driver adapter. Use `@prisma/adapter-better-sqlite3` and pass it to `new PrismaClient({ adapter })`.
- Cache your Prisma client on `globalThis` to avoid SQLite locking during HMR in development. Production uses lazy Proxy init:
  ```typescript
  import 'dotenv/config';
  import { PrismaClient } from './generated/prisma/client';
  let _db: PrismaClient | undefined;
  export const db = new Proxy({} as PrismaClient, {
    get(_, prop) {
      const client = _db ?? (_db = (() => {
        const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
        return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL!.replace(/\?.*$/, '') }) });
      })());
      return typeof client[prop] === 'function' ? client[prop].bind(client) : client[prop];
    },
  });
  ```

### 4. Direct Form Navigation
- After successful auth or setup, execute a **`window.location.href = "/dashboard"`** instead of client-side `router.push()`. Standard React Router navigations skip transmitting the updated HTTP-only cookie headers on immediate next fetches.

### 5. Supress Browser Extension Warnings in Development
- Suppress runtime extension error overlays in the root layout's `useEffect` (e.g. suppression of `moz-extension://` or `chrome-extension://` warnings).

---

## 🛠️ Versioning & Releases Checklist
When updating the app version (starting at `0.1.0` SemVer):
1. `package.json` — `"version"`
2. `AGENTS.md` — overview block version
3. Settings page — Info footer display
4. README.md — badges & logs
5. `plan.md` — title current indicator
6. `CHANGELOG.md` — add clean dated release log
7. **Rule**: NEVER perform `git tag` or trigger GitHub release actions. Only the human owner creates tags or releases.
