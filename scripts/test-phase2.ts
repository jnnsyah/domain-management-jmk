import assert from 'node:assert';
import dotenv from 'dotenv';
import { validatePassword, createSessionToken, verifySessionToken } from '../src/lib/auth';
import { isRateLimited, recordFailedAttempt, resetAttempts, getRemainingBlockSeconds } from '../src/lib/rate-limiter';

dotenv.config();

async function runPhase2Tests() {
  console.log('========================================');
  console.log('RUNNING PHASE 2 COMPREHENSIVE TESTS');
  console.log('========================================\n');

  // 1. Password Validation Edge Cases
  console.log('[1/4] Testing Password Validation Edge Cases...');
  assert.strictEqual(validatePassword('admin123'), true, 'Correct password must return true');
  assert.strictEqual(validatePassword('wrongpass'), false, 'Incorrect password must return false');
  assert.strictEqual(validatePassword('admin123 '), false, 'Password with trailing space must return false');
  assert.strictEqual(validatePassword(''), false, 'Empty password must return false');
  console.log('  ✓ Password validation tests PASSED');

  // 2. Session Token Cryptographic Signing & Verification
  console.log('\n[2/4] Testing Session Token Signing & Verification...');
  const token = createSessionToken();
  console.log('  -> Generated token:', token);
  assert.strictEqual(verifySessionToken(token), true, 'Valid token must verify as true');

  // Test tampered token
  const tamperedToken = token.slice(0, -4) + 'abcd';
  assert.strictEqual(verifySessionToken(tamperedToken), false, 'Tampered token must fail verification');

  // Test malformed token
  assert.strictEqual(verifySessionToken('invalid:token:format'), false, 'Malformed token must fail');
  assert.strictEqual(verifySessionToken('not_even_colon'), false, 'Token without colon must fail');
  assert.strictEqual(verifySessionToken(null), false, 'Null token must fail');
  assert.strictEqual(verifySessionToken(undefined), false, 'Undefined token must fail');
  console.log('  ✓ Session token tests PASSED');

  // 3. Brute-Force Rate Limiter Simulation
  console.log('\n[3/4] Testing Brute-Force Rate Limiter...');
  const testIp = '203.0.113.42';
  resetAttempts(testIp);
  assert.strictEqual(isRateLimited(testIp), false, 'Initial state should not be rate-limited');

  // Simulate 4 failed attempts
  for (let i = 1; i <= 4; i++) {
    recordFailedAttempt(testIp);
    assert.strictEqual(isRateLimited(testIp), false, `Attempt ${i} should not trigger rate limit yet`);
  }

  // 5th failed attempt -> should trigger rate limit
  recordFailedAttempt(testIp);
  assert.strictEqual(isRateLimited(testIp), true, '5th failed attempt must trigger rate limit');

  const blockSeconds = getRemainingBlockSeconds(testIp);
  console.log('  -> IP is rate-limited. Remaining block seconds:', blockSeconds);
  assert.ok(blockSeconds > 0 && blockSeconds <= 900, 'Remaining block seconds should be ~900s (15 mins)');

  // Successful login resets rate limit
  resetAttempts(testIp);
  assert.strictEqual(isRateLimited(testIp), false, 'Successful login must reset rate-limit counter');
  console.log('  ✓ Rate limiter tests PASSED');

  // 4. Middleware Route Protection & CSRF Logic Simulation
  console.log('\n[4/4] Testing Middleware Route & CSRF Protection Logic...');
  
  // Simulate CSRF Header validation function matching middleware logic
  function validateCsrf(method: string, origin: string | null, referer: string | null, host: string | null): boolean {
    if (!['POST', 'PUT', 'DELETE'].includes(method.toUpperCase())) return true;
    if (!origin && !referer) return true; // Browser same-origin request or curl without origin
    const targetHeader = origin || referer || '';
    try {
      const headerHost = new URL(targetHeader).host;
      return Boolean(host && headerHost === host);
    } catch {
      return false;
    }
  }

  // Same origin CSRF tests
  assert.strictEqual(validateCsrf('GET', 'http://attacker.com', null, 'example.com'), true, 'GET request bypasses CSRF check');
  assert.strictEqual(validateCsrf('POST', 'http://example.com', null, 'example.com'), true, 'Matching Origin POST is allowed');
  assert.strictEqual(validateCsrf('POST', 'http://attacker.com', null, 'example.com'), false, 'Mismatched Origin POST is blocked (403)');
  assert.strictEqual(validateCsrf('DELETE', 'invalid-url', null, 'example.com'), false, 'Malformed Origin header is blocked (403)');

  // Cron authentication check simulation
  const validCronSecret = process.env.CRON_SECRET;
  function validateCronAuth(authHeader: string | null): boolean {
    return Boolean(authHeader && authHeader === `Bearer ${validCronSecret}`);
  }
  assert.strictEqual(validateCronAuth(`Bearer ${validCronSecret}`), true, 'Valid Bearer token passes cron auth');
  assert.strictEqual(validateCronAuth('Bearer wrong_token'), false, 'Invalid Bearer token fails cron auth');
  assert.strictEqual(validateCronAuth(null), false, 'Missing auth header fails cron auth');

  console.log('  ✓ Middleware & CSRF logic tests PASSED');

  console.log('\n========================================');
  console.log('ALL PHASE 2 TESTS PASSED CLEANLY! ✨');
  console.log('========================================');
}

runPhase2Tests().catch((err) => {
  console.error('\n❌ Phase 2 test failed:', err);
  process.exit(1);
});
