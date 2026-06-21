# Pillar Agent Instructions (AGENTS.md)

This project contains specific architecture patterns and development directives. Any AI developer editing this repository must adhere to the rules laid out in this document and `agent.md`.

---

## 🚀 Quick Commands
- **Install packages**: `npm install`
- **Local dev server**: `npm run dev`
- **Build standalone**: `npm run build`
- **Check code quality**: `npm run lint`
- **Sync database**: `npm run db:push`
- **Start WebSocket / Web Gateway**: `npm start` (Runs custom `server.ts`)
- **Run all tests**: `npm test` (Vitest — 122 tests across 15 files)
- **Test watch mode**: `npm run test:watch`
- **Test with coverage**: `npm run test:coverage`
- **Legacy integration test**: `npm run test:integration` (Runs `test-ssh.ts`)

---

## 📁 Directory Structure
```
pillar/
├── server.ts                  # Express.js + Next.js + WebSocket entry
├── next.config.ts             # Standalone Next.js config
├── tsconfig.json              # TypeScript compilation rules
├── package.json               # Dependencies and scripts
├── LICENSE                    # AGPL-3.0 copyleft license
├── .github/
│   └── FUNDING.yml            # Buy Me a Coffee settings
│
├── prisma/
│   ├── schema.prisma          # Prisma schema definitions
│   └── dev.db                 # Local development SQLite file
│
├── src/
│   ├── app/                   # App Router files
│   │   ├── layout.tsx         # Root layout (theme, font, error handling)
│   │   ├── page.tsx           # Entry router (redirects to /dashboard or login)
│   │   ├── globals.css        # Theme selectors & variables (NO Tailwind)
│   │   ├── (auth)/            # Auth routes group
│   │   │   ├── login/
│   │   │   └── setup/         # First-run admin creation
│   │   ├── (app)/             # Authenticated client workspace
│   │   │   ├── dashboard/
│   │   │   ├── connections/
│   │   │   │   └── [id]/      # Terminal page
│   │   │   ├── settings/      # Account & Preferences
│   │   │   ├── docs/          # Markdown documentation
│   │   │   └── apidocs/       # Dynamic API specifications
│   │   └── api/               # Protected API routes
│   │
│   ├── components/            # Scoped elements and UI buttons
│   ├── lib/                   # Database singletons, crypto, SSH engine
│   └── types/                 # TypeScript models
│
└── docs/content/              # Markdown guides for docs portal
```

---

## 🔒 Security Best Practices
1. **Never write unencrypted credentials**: Passwords, private keys, and MFA secrets must pass through `lib/crypto.ts` before database insertion.
2. **Never log decrypted keys**: Mask decrypted strings inside debug output.
3. **Verify owner scopes**: Every connection request must check if `userId === session.user.id` or if the record is shared with the current user inside `SharedConnection`.
4. **Enforce Role Access**: Admin features must check `session.user.role === 'ADMIN'`. Reject unauthorized edits with `HTTP 403 Forbidden`.

---

## 🎨 No Tailwind CSS Absolute Mandate
This project utilizes Next.js **CSS Modules** (`*.module.css`) for UI scoping and CSS Custom Properties for theme variables.
1. DO NOT write class lists matching Tailwind CSS styles.
2. DO NOT install package scripts referencing tailwind.
3. If changing theme templates, add custom properties inside `styles/globals.css` with attribute rules like `[data-theme="dracula-dark"]`.

---

## 🏷️ Releases and Tags Policy
- **NEVER** run `git tag` or call GitHub release APIs autonomously. Bumping version strings in repository documents is encouraged, but committing tags remains the human owner's action.

---

## 📝 Development Gotchas

### Gotcha #url-parse: `url.parse()` is deprecated but required for Next.js
- Node.js 26 deprecates `url.parse()` in favor of the WHATWG `new URL()` API.
- All WebSocket handlers in `server.ts` use a custom `parseUrl()` helper based on `new URL()`.
- The Next.js catch-all handler (`expressApp.use((req, res) => handle(req, res, parsedUrl))`) **must** use the deprecated `url.parse()` because Next.js's `getRequestHandler` expects `NextUrlWithParsedQuery`.
- DO NOT replace the `parse()` call on the catch-all middleware line — it will break Next.js routing.
- The deprecation warning for this single remaining usage is suppressed via import comment.

---

## 📖 Docs Sync Rule
Whenever asked "is docs updated?" or "update docs", you must audit and synchronize these five files/folders:
1. `docs/content/` (Guide Markdown files)
2. `/apidocs` UI & schemas
3. `README.md`
4. `AGENTS.md`
5. `plan.md`
