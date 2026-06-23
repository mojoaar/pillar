# Two-Factor Authentication (MFA) Setup

To guarantee the security of your remote gateway, Pillar includes mandatory and optional **Multi-Factor Authentication (MFA)** backing.

---

## 🔒 What is TOTP MFA?

TOTP (Time-Based One-Time Password) is an open standard (RFC 6238) that generates a unique, rotating 6-digit security token every 30 seconds. Even if an attacker gains access to your login email and password, they cannot sign in without possessing your physical authenticator device.

---

## 📱 Supported Authenticator Apps

Pillar's MFA enrollment uses standard `otpauth` URIs, making it fully compatible with all popular authenticator apps:

- **Google Authenticator** (iOS & Android)
- **Microsoft Authenticator** (iOS & Android)
- **Authy** (iOS, Android, Desktop)
- **Bitwarden / 1Password** (Integrated password managers)
- **Aegis / Raivo OTP** (Open-source privacy focused)

---

## ⚙️ How to Enroll

1. Sign in to your Pillar dashboard and navigate to **Settings** in the sidebar.
2. Select the **Security & MFA** tab.
3. Under **Two-Factor Authentication (MFA)**, click **Configure Multi-Factor Authentication**.
4. An interactive setup guide will appear, displaying:
   - A secure **QR Code**.
   - A 16-character **Manual key code** (e.g. `JBSWY3DPEHPK3PXP`).
5. Open your authenticator app on your mobile device:
   - Tap **Scan a QR code** and point your device camera at your browser screen.
   - Alternatively, choose **Enter a setup key**, input `Pillar Gateway` as the account name, and paste the 16-character manual key code.
6. Your app will immediately begin generating a rotating 6-digit code labeled `Pillar Gateway (your-email)`.
7. Enter the current 6-digit code into the **Verification Code** input box in Pillar and click **Enable TOTP**.

Once verified, the setup state updates, and TOTP MFA is fully enabled on your account.

---

## 🔄 Signing In with MFA

Subsequent login attempts undergo a two-step challenge flow:
1. Enter your email and password as normal on the login screen.
2. If correct, the login card automatically slides open to reveal the **🔑 Enter MFA Code** challenge box.
3. Open your mobile authenticator app, read the current 6-digit token, and enter it to complete the login!

---

## 🔑 Administrative MFA Overrides

If you lose your authenticator device, your gateway is protected against locking out.
- Any registered **ADMIN** user can navigate to the **Admin Panel → User Manager** dashboard.
- Select your account and click **Reset MFA**.
- This instantly disables MFA on your account, allowing you to sign in with password credentials and enroll a new device.
- All overrides write complete system event logs inside the **System Audit Logs** tracker.
