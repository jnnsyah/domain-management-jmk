interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const attemptsMap = new Map<string, RateLimitEntry>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Clean up expired rate limit entries to prevent memory leaks
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [ip, entry] of attemptsMap.entries()) {
    if (now > entry.resetTime) {
      attemptsMap.delete(ip);
    }
  }
}

/**
 * Checks if an IP address is currently rate-limited (PRD Section 4.3)
 */
export function isRateLimited(ip: string): boolean {
  cleanupExpiredEntries();
  const entry = attemptsMap.get(ip);
  if (!entry) return false;
  
  if (Date.now() > entry.resetTime) {
    attemptsMap.delete(ip);
    return false;
  }

  return entry.count >= MAX_ATTEMPTS;
}

/**
 * Records a failed login attempt for an IP address
 */
export function recordFailedAttempt(ip: string): void {
  cleanupExpiredEntries();
  const now = Date.now();
  const entry = attemptsMap.get(ip);

  if (!entry || now > entry.resetTime) {
    attemptsMap.set(ip, {
      count: 1,
      resetTime: now + WINDOW_MS,
    });
  } else {
    entry.count += 1;
  }
}

/**
 * Resets failed attempts for an IP upon successful login
 */
export function resetAttempts(ip: string): void {
  attemptsMap.delete(ip);
}

/**
 * Gets remaining block time in seconds for a rate-limited IP
 */
export function getRemainingBlockSeconds(ip: string): number {
  const entry = attemptsMap.get(ip);
  if (!entry) return 0;
  const remainingMs = entry.resetTime - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}
