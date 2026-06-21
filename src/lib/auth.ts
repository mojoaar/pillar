import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from './db';
import bcrypt from 'bcryptjs';
import { decrypt, encrypt } from './crypto';
import { authenticator } from 'otplib';
import { writeAudit } from './audit';

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

        const email = credentials.email as string;
        const password = credentials.password as string;
        const totpCode = (credentials.totpCode as string | undefined)?.trim().toUpperCase();

        // Fetch user from database
        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user) {
          throw new Error('Invalid credentials');
        }

        if (user.isSuspended) {
          throw new Error('Account suspended. Contact administration.');
        }

        // Validate password using bcryptjs
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
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
              throw new Error('Invalid MFA or recovery code.');
            }

            // Decrypt the stored backup recovery codes list
            let decryptedBackupCodesStr: string;
            try {
              decryptedBackupCodesStr = decrypt(user.mfaBackupCodes);
            } catch (err) {
              console.error('Failed to decrypt user backup codes:', err);
              throw new Error('Decryption error');
            }

            const backupCodesArray = decryptedBackupCodesStr.split(',');
            const matchedIndex = backupCodesArray.indexOf(totpCode);

            if (matchedIndex === -1) {
              throw new Error('Invalid MFA or recovery code.');
            }

            // Code matches! Remove the used single-use code from the array
            backupCodesArray.splice(matchedIndex, 1);
            
            // Re-encrypt and save remaining backup codes
            const updatedBackupCodesStr = backupCodesArray.length > 0 
              ? encrypt(backupCodesArray.join(',')) 
              : null;

            await db.user.update({
              where: { id: user.id },
              data: { mfaBackupCodes: updatedBackupCodesStr },
            });

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
              throw new Error('MFA configuration error. Contact administration.');
            }

            // Decrypt stored secret
            let decryptedSecret: string;
            try {
              decryptedSecret = decrypt(user.mfaSecret);
            } catch (err) {
              console.error('Failed to decrypt user mfa secret:', err);
              throw new Error('Decryption error');
            }

            // Validate TOTP code using otplib
            const isValidTotp = authenticator.check(totpCode, decryptedSecret);
            if (!isValidTotp) {
              throw new Error('Invalid MFA code');
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
});
