import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from './db';
import bcrypt from 'bcryptjs';
import { decrypt, encrypt } from './crypto';
import { NobleCryptoPlugin, ScureBase32Plugin, verifySync } from 'otplib';
import { writeAudit } from './audit';

// Shared crypto and base32 plugins for TOTP operations
const totpCrypto = new NobleCryptoPlugin();
const totpBase32 = new ScureBase32Plugin();

// In-memory credential rate limiter: 5 attempts per email per 15 minutes
const credentialAttempts = new Map<string, number[]>();
function checkLoginRateLimit(email: string): boolean {
  const now = Date.now();
  const attempts = credentialAttempts.get(email) || [];
  const recent = attempts.filter((t) => t > now - 15 * 60 * 1000);

  if (recent.length >= 5) return false;

  recent.push(now);
  credentialAttempts.set(email, recent);
  return true;
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
        totpCode: { label: 'MFA Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;
        const totpCode = (credentials.totpCode as string | undefined)?.trim().toUpperCase();

        // Rate limit credential attempts per email
        if (!checkLoginRateLimit(email)) {
          throw new Error('Too many login attempts. Please try again later.');
        }

        // Fetch user from database
        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user) {
          // Log failed login attempt (unregistered email)
          await writeAudit(null, 'Login Failed', null, { email, reason: 'Email not registered' });
          throw new Error('Invalid credentials');
        }

        if (user.isSuspended) {
          // Log failed login attempt (suspended account)
          await writeAudit(user.id, 'Login Failed', null, { email, reason: 'Account suspended' });
          throw new Error('Invalid credentials');
        }

        // Validate password using bcryptjs
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
          // Log failed login attempt (password mismatch)
          await writeAudit(user.id, 'Login Failed', null, { email, reason: 'Incorrect password' });
          throw new Error('Invalid credentials');
        }

        // Check if MFA is enforced but not yet enrolled
        if (user.mfaEnforced && !user.mfaEnabled) {
          await writeAudit(user.id, 'Login Failed', null, { email, reason: 'MFA enforced but not enrolled' });
          throw new Error('Invalid credentials');
        }

        // Check if MFA (TOTP) is required
        if (user.mfaEnabled) {
          if (!totpCode) {
            // Signal to Client form that MFA Code is required
            throw new Error('MFA_REQUIRED');
          }

          // Check if the submitted code is an alphanumeric backup recovery code (format: XXXX-XXXX)
          const isBackupCodeFormat = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(totpCode);

          if (isBackupCodeFormat) {
            if (!user.mfaBackupCodes) {
              await writeAudit(user.id, 'Login Failed', null, { email, reason: 'Missing recovery codes' });
              throw new Error('Invalid credentials');
            }

            // Decrypt the stored backup recovery codes list
            let decryptedBackupCodesStr: string;
            try {
              decryptedBackupCodesStr = decrypt(user.mfaBackupCodes);
            } catch (err: any) {
              console.error('Failed to decrypt user backup codes:', err.message);
              throw new Error('Invalid credentials');
            }

            const backupCodesArray = decryptedBackupCodesStr.split(',');
            const matchedIndex = backupCodesArray.indexOf(totpCode);

            if (matchedIndex === -1) {
              await writeAudit(user.id, 'Login Failed', null, { email, reason: 'Incorrect recovery code' });
              throw new Error('Invalid credentials');
            }

            // Code matches! Remove the used single-use code from the array
            backupCodesArray.splice(matchedIndex, 1);
            
            // Re-encrypt and save remaining backup codes
            const updatedBackupCodesStr = backupCodesArray.length > 0
              ? encrypt(backupCodesArray.join(','))
              : null;

            // Atomic update with optimistic locking to prevent race conditions on single-use codes
            const result = await db.user.updateMany({
              where: { id: user.id, mfaBackupCodes: user.mfaBackupCodes },
              data: { mfaBackupCodes: updatedBackupCodesStr },
            });

            if (result.count === 0) {
              throw new Error('Invalid credentials');
            }

            // Log the recovery code redemption event
            await writeAudit(
              user.id,
              'MFA Backup Code Redeemed',
              null,
              { message: `User redeemed single-use recovery code. ${backupCodesArray.length} codes remaining.` }
            );

          } else {
            // Standard TOTP Verification
            if (!user.mfaSecret) {
              throw new Error('Invalid credentials');
            }

            // Decrypt stored secret
            let decryptedSecret: string;
            try {
              decryptedSecret = decrypt(user.mfaSecret);
            } catch (err: any) {
              console.error('Failed to decrypt user mfa secret:', err.message);
              throw new Error('Invalid credentials');
            }

            // Validate TOTP code using otplib
            const result = verifySync({ token: totpCode, secret: decryptedSecret, epochTolerance: [0, 1], crypto: totpCrypto, base32: totpBase32 });
            const isValidTotp = result.valid;
            if (!isValidTotp) {
              await writeAudit(user.id, 'Login Failed', null, { email, reason: 'Incorrect MFA code' });
              throw new Error('Invalid credentials');
            }
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          role: user.role,
          mfaEnabled: user.mfaEnabled,
        };
      },
    }),
  ],
  // Event hooks to capture security audit events (Finding #audit-events)
  events: {
    async signIn({ user }) {
      if (user && user.id) {
        await writeAudit(
          user.id,
          'Login Succeeded',
          null,
          { message: `User logged in successfully. Email: ${user.email}` }
        );
      }
    },
    async signOut(message: any) {
      const token = message?.token;
      if (token && token.id) {
        await writeAudit(
          token.id as string,
          'Logout Succeeded',
          null,
          { message: 'User logged out of active gateway session.' }
        );
      }
    }
  }
});
