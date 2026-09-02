import crypto from 'node:crypto';
import * as dotenv from 'dotenv';

// Ensure .env variables are loaded in all runtime environments
dotenv.config();

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || (import.meta.env ? import.meta.env.SESSION_SECRET : undefined);
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is missing.');
  }
  return secret;
}

/**
 * Validates provided password against ADMIN_PASSWORD env var
 */
export function validatePassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD || (import.meta.env ? import.meta.env.ADMIN_PASSWORD : undefined);
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD environment variable is missing.');
  }
  
  const a = Buffer.from(password);
  const b = Buffer.from(adminPassword);

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Creates a cryptographically signed session token
 * Format: `<timestamp_ms>:<hmac_signature>`
 */
export function createSessionToken(): string {
  const secret = getSessionSecret();
  const timestamp = Date.now().toString();
  const hmac = crypto.createHmac('sha256', secret).update(timestamp).digest('hex');
  return `${timestamp}:${hmac}`;
}

/**
 * Verifies a session token string
 */
export function verifySessionToken(token: string | null | undefined): boolean {
  if (!token) return false;
  
  const parts = token.split(':');
  if (parts.length !== 2) return false;

  const [timestampStr, expectedSignature] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  const now = Date.now();
  if (now < timestamp || now - timestamp > SESSION_TTL_MS) {
    return false;
  }

  try {
    const secret = getSessionSecret();
    const actualSignature = crypto.createHmac('sha256', secret).update(timestampStr).digest('hex');
    
    const a = Buffer.from(expectedSignature, 'hex');
    const b = Buffer.from(actualSignature, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
