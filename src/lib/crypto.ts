import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Obtain encryption key, ensuring it is exactly 32 bytes (256 bits)
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required.');
  }

  // Must be a 64-character hex string for proper 32-byte key material
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string.');
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a unified string format: "iv_hex:tag_hex:ciphertext_hex"
 */
export function encrypt(text: string): string {
  if (text == null) throw new Error('encrypt() requires a non-null string input');
  if (!text) return '';
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // GCM standard IV is 12 bytes
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string in the format "iv_hex:tag_hex:ciphertext_hex".
 */
export function decrypt(encryptedText: string): string {
  if (encryptedText == null) throw new Error('decrypt() requires a non-null string input');
  if (!encryptedText) return '';
  
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted text format. Expected iv:tag:ciphertext');
  }
  
  const [ivHex, tagHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Masks a sensitive string for safe logging/display.
 */
export function maskSecret(text: string | null | undefined): string {
  if (!text) return '';
  return '••••••••';
}
