interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Separate maps for different rate limit types
const loginAttemptsMap = new Map<string, RateLimitEntry>();
const apiReadMap = new Map<string, RateLimitEntry>();
const apiWriteMap = new Map<string, RateLimitEntry>();

// Rate limit configurations
const RATE_LIMITS = {
  LOGIN: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },    // 5 attempts per 15 minutes
  API_READ: { maxAttempts: 60, windowMs: 60 * 1000 },     // 60 requests per minute
  API_WRITE: { maxAttempts: 30, windowMs: 60 * 1000 },    // 30 requests per minute
};

/**
 * Clean up expired rate limit entries to prevent memory leaks
 */
function cleanupExpiredEntries(map: Map<string, RateLimitEntry>) {
  const now = Date.now();
  for (const [ip, entry] of map.entries()) {
    if (now > entry.resetTime) {
      map.delete(ip);
    }
  }
}

/**
 * Generic rate limit check
 */
function checkRateLimit(
  ip: string,
  map: Map<string, RateLimitEntry>,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetTime: number } {
  cleanupExpiredEntries(map);
  const now = Date.now();
  const entry = map.get(ip);

  if (!entry || now > entry.resetTime) {
    const resetTime = now + windowMs;
    map.set(ip, { count: 1, resetTime });
    return { allowed: true, remaining: maxAttempts - 1, resetTime };
  }

  entry.count += 1;
  const allowed = entry.count <= maxAttempts;
  const remaining = Math.max(0, maxAttempts - entry.count);

  return { allowed, remaining, resetTime: entry.resetTime };
}

/**
 * Checks if an IP address is currently rate-limited for login (PRD Section 4.3)
 */
export function isRateLimited(ip: string): boolean {
  cleanupExpiredEntries(loginAttemptsMap);
  const entry = loginAttemptsMap.get(ip);
  if (!entry) return false;
  
  if (Date.now() > entry.resetTime) {
    loginAttemptsMap.delete(ip);
    return false;
  }

  return entry.count >= RATE_LIMITS.LOGIN.maxAttempts;
}

/**
 * Records a failed login attempt for an IP address
 */
export function recordFailedAttempt(ip: string): void {
  cleanupExpiredEntries(loginAttemptsMap);
  const now = Date.now();
  const entry = loginAttemptsMap.get(ip);

  if (!entry || now > entry.resetTime) {
    loginAttemptsMap.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMITS.LOGIN.windowMs,
    });
  } else {
    entry.count += 1;
  }
}

/**
 * Resets failed attempts for an IP upon successful login
 */
export function resetAttempts(ip: string): void {
  loginAttemptsMap.delete(ip);
}

/**
 * Gets remaining block time in seconds for a rate-limited IP
 */
export function getRemainingBlockSeconds(ip: string): number {
  const entry = loginAttemptsMap.get(ip);
  if (!entry) return 0;
  const remainingMs = entry.resetTime - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

/**
 * Check rate limit for API read operations (GET)
 */
export function checkApiReadLimit(ip: string) {
  return checkRateLimit(ip, apiReadMap, RATE_LIMITS.API_READ.maxAttempts, RATE_LIMITS.API_READ.windowMs);
}

/**
 * Check rate limit for API write operations (POST, PUT, DELETE)
 */
export function checkApiWriteLimit(ip: string) {
  return checkRateLimit(ip, apiWriteMap, RATE_LIMITS.API_WRITE.maxAttempts, RATE_LIMITS.API_WRITE.windowMs);
}

/**
 * Generate rate limit response headers
 */
export function getRateLimitHeaders(remaining: number, resetTime: number) {
  return {
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': new Date(resetTime).toISOString(),
    'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
  };
}
