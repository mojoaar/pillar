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

---

## 🔌 Extensible Plugins Framework

Pillar features a robust, secure, and extensible plugins framework that allows administrators to toggle external system integrations globally without bloat.

### 🔐 Security & Encrypted Configuration
All plugin configurations are:
1. **Encrypted at rest** using AES-256-GCM with your gateway's master `ENCRYPTION_KEY`.
2. **Sanitized on outputs**: When viewing configs on the Admin panel, passwords, token secrets, and keys are automatically masked (`••••••••`) before API delivery.

---

## ☁️ Proxmox VE Integration Guide

The Proxmox VE plugin enables cluster-wide virtual machine (QEMU) and Container (LXC) status monitoring, live cluster-node metric charting, and dynamic power lifecycle execution from a unified dashboard.

### 1. Proxmox VE API User & Privilege Configurations
To securely connect Pillar to your Proxmox environment, it is highly recommended to set up a dedicated API user on your Proxmox host rather than using `root@pam`.

#### Step A: Create a Custom API Role
On your Proxmox VE web interface:
1. Navigate to **Datacenter &rarr; Permissions &rarr; Roles**.
2. Click **Create** and name the role `PillarGateway` (or similar).
3. Assign the following privileges:
   - **`VM.Audit`**: Allows Pillar to read VM status, configurations, and resource limits.
   - **`VM.PowerMgmt`**: Required to trigger power operations (Start, Stop, Shutdown, Reboot, Suspend).
   - **`VM.Monitor`**: Required to query QEMU guest agent for VM IP addresses and network interfaces.
   - **`Sys.Audit`**: Required to read physical cluster host node CPU, RAM, and disk status metrics.

#### Step B: Create a Dedicated API User
1. Navigate to **Datacenter &rarr; Permissions &rarr; Users**.
2. Click **Add** and create a new local user (e.g. `pillar-api@pve`). Note that you do not need to assign a password if utilizing API Tokens.

#### Step C: Generate an API Token
1. Under **Datacenter &rarr; Permissions &rarr; API Tokens**, click **Add**.
2. Select your newly created user (`pillar-api@pve`) and assign a Token ID (e.g. `pillar-token`).
3. **CRITICAL**: Ensure **Privilege Separation** is unchecked if you plan to bind permissions directly to the token.
4. Click **Add**. Copy the generated **Token ID** and the **Secret Value** immediately (Proxmox will never display the secret again).
   - Your API Token ID will look like: `pillar-api@pve!pillar-token`
   - Your Secret Value will look like: `12345678-abcd-1234-abcd-1234567890ab`

#### Step D: Assign Token Permissions
1. Navigate to **Datacenter &rarr; Permissions**.
2. Click **Add &rarr; API Token Permission**.
3. Set path to `/` (cluster-wide access) or `/vms` (to restrict to VMs only).
4. Select your token (`pillar-api@pve!pillar-token`).
5. Select the Role created in Step A (`PillarGateway`).

---

### 2. Configure Plugin inside Pillar
1. Sign in to Pillar as an **ADMIN**.
2. Navigate to **Manage Plugins** (`/admin/plugins`) inside your left navigation panel.
3. Click **Configure** on the Proxmox VE plugin card.
4. Set **Enable Plugin** to active.
5. Populate the input parameters:
   - **Proxmox API URL**: Point to your cluster's API endpoint (e.g., `https://192.168.1.100:8006/api2/json`).
   - **API Token ID & Secret**: Enter your generated PVE credentials formatted as: `pillar-api@pve!pillar-token=12345678-abcd-1234-abcd-1234567890ab`.
   - **Verify SSL Certificate**: If your home laboratory uses self-signed SSL/TLS certificates (producing default warning blocks in standard browsers), **uncheck** this box. Pillar will safely bypass certificate chain validation for this connector context without compromising global security headers.
6. Click **Save Configuration**.

---

### 3. Standalone Hosts vs. Multi-Node Clusters
The Proxmox plugin automatically adjusts to match your environment's topology:
- **Standalone single host**: Pillar discovers and lists resources on the single hypervisor.
- **Multi-node cluster**: Pillar queries cluster resource maps (`/cluster/resources`), displaying live node metric statuses for **every host** in the cluster.
- **Failover / Live-Migration Routing**: When triggering VM actions (e.g., Reboot), Pillar dynamically determines which node currently hosts the instance and routes the API request directly to that node. If a VM is migrated from `pve-01` to `pve-02`, Pillar handles the change seamlessly with zero manual profile updates!

---

### 4. Granting User Access Scopes
- By default, only users with the **`ADMIN`** role can view the Proxmox Console or access its API endpoints.
- To grant a standard (`USER`-role) account access to view and control Proxmox VMs:
  1. Go to **Admin Panel &rarr; User Accounts**.
  2. Click the **🔌 Plugins** button next to their name.
  3. Check the **Proxmox VE Plugin** box and click **Save Permissions**.
  4. The **Proxmox Console** navigation tab will instantly appear in their left sidebar!
