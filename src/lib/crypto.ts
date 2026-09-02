import crypto from 'node:crypto';
import * as dotenv from 'dotenv';

// Ensure .env variables are loaded in all runtime environments
dotenv.config();

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || (import.meta.env ? import.meta.env.ENCRYPTION_KEY : undefined);
  if (!secret) {
    throw new Error('ENCRYPTION_KEY environment variable is not defined.');
  }

  // If secret is 64 hex chars, parse as hex (32 bytes)
  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }

  // Otherwise convert string to buffer and enforce 32 bytes via sha256 hash if needed
  if (Buffer.byteLength(secret, 'utf8') === 32) {
    return Buffer.from(secret, 'utf8');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts plaintext using AES-256-GCM
 * Returns format: `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
 */
export function encrypt(text: string | null | undefined): string | null {
  if (!text) return null;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts ciphertext formatted as `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
 */
export function decrypt(encryptedText: string | null | undefined): string | null {
  if (!encryptedText) return null;
  
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    return encryptedText;
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  try {
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Decryption failed:', err);
    return null;
  }
}
