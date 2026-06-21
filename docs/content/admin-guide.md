# Administration & Security Auditing Guide

The Pillar administrative panel provides owners complete control over local user registrations, suspension cycles, MFA device overrides, system metrics, and audit log pipelines.

---

## 🛡️ Administrative Role (ADMIN)

Pillar implements strict role-based access control (RBAC):
- **USER**: Can create, edit, delete, share, and connect to their own connection profiles. They cannot see admin panels or edit other accounts.
- **ADMIN**: Holds all user-tier permissions, plus complete access to administrative APIs (`/api/admin/*`) and pages (`/admin/*`).
- **First User**: The very first user created during the `/setup` onboarding wizard is automatically granted the `ADMIN` role.

---

## 📊 System Diagnostics & Metrics

The administrative overview panel polls real-time host hardware metrics:
1. **CPU Load Average**: Monitored via Node.js native `os.loadavg()` module.
2. **RAM Utilization**: Displays total system RAM, active memory buffers, and calculated free memory allocations.
3. **Active SSH Sessions**: Displays real-time counts of active WebSocket-to-SSH bridging tunnels, including details on caller names, session start times, and remote host endpoints.

---

## 👥 User Management Dashboard

Admins can perform CRUD operations on user accounts:
- **Create User**: Add new local accounts (assigning default `USER` or `ADMIN` roles).
- **Suspend/Unsuspend**: Suspending an account instantly terminates all active WebSocket sessions for that user and blocks all subsequent sign-in attempts.
- **MFA Override (Reset MFA)**: Disables TOTP requirement on a user account if they lose their physical authentication device.

---

## 📝 Unified System Audit Logs

Every database alteration, login attempt, connection handshaking event, or administrative bypass writes a complete audit record inside the SQLite database.

### Core Events Logged:
- `Login Succeeded` / `Login Failed`
- `MFA Enrollment Completed`
- `MFA Override Triggered`
- `SSH Profile Created` / `Updated` / `Deleted`
- `SSH Session Initializing` / `Closed`
- `User Account Created` / `Suspended` / `Deleted`

### Security Audits Screen:
The audit dashboard lists all logs chronologically.
- **Timezone adjustment**: Timestamps are translated to your local timezone in real-time.
- **Filtering**: Filter logs by User, Event type, or IP.
- **Persistence**: Audit logs are kept permanently to ensure clear traceability, paginated in 25-record increments in the UI to keep render loads minimal.
