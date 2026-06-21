# API Keys & Programmatic Access

Pillar provides personal API tokens that allow external scripts, CLI tools, and automation platforms to interact with the gateway programmatically.

---

## 🔑 Generating API Tokens

1. Sign in to Pillar and navigate to **Settings → API Keys**.
2. Click **New Token**.
3. Enter a descriptive name (e.g. "HomeAssistant Integration").
4. Optionally set an expiration period in days.
5. Click **Generate Token**.

The full token is displayed **exactly once**. Copy it immediately — it will never be shown again.

---

## 🔐 Token Format & Authentication

Tokens follow the format:

```
pil_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Authenticate API requests by including the token in an `Authorization` header:

```bash
curl -H "Authorization: Bearer pil_live_xxx..." https://pillar.example.com/api/connections
```

Or via environment variable:

```bash
export PILLAR_TOKEN="pil_live_xxx..."
curl -H "Authorization: Bearer $PILLAR_TOKEN" https://pillar.example.com/api/admin/metrics
```

---

## 🛡️ Security Design

- Tokens are **never stored in plaintext** — only SHA-256 HMAC hashes with a server pepper are persisted
- Tokens have **256 bits of entropy** (32 random bytes)
- Each token can be individually **revoked** from the API Keys panel
- Revoked tokens lose access immediately
- Admin-only endpoints require the token owner to have the `ADMIN` role
- Plugin-specific endpoints require the token owner to be authorized for that plugin

---

## 📡 Available Endpoints for Scripting

| Method   | Endpoint                     | Auth Required     |
| -------- | ---------------------------- | ----------------- |
| `GET`      | `/api/connections`             | Session or Bearer |
| `GET`      | `/api/admin/metrics`           | Admin             |
| `GET`      | `/api/admin/audit`             | Admin             |
| `GET/POST` | `/api/plugins/proxmox`         | Proxmox plugin    |

Full API documentation is available at `/apidocs`.

---

## 🔄 Token Lifecycle

1. **Generate** — Create a token in Settings
2. **Use** — Include in `Authorization: Bearer <token>` header
3. **Revoke** — Delete the token to immediately block access
4. **Expire** — Tokens with expiration dates stop working automatically

Revoked and expired tokens are permanently deleted and cannot be recovered.
