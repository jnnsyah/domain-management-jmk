import assert from 'node:assert';
import dotenv from 'dotenv';
import { encrypt, decrypt } from '../src/lib/crypto';
import { parseRawText } from '../src/lib/parser';
import { resolveDomainIp } from '../src/lib/dns';

dotenv.config();

async function runTests() {
  console.log('========================================');
  console.log('RUNNING PHASE 1 VERIFICATION TESTS');
  console.log('========================================\n');

  // 1. Encryption Test
  console.log('[1/3] Testing Crypto Subsystem (AES-256-GCM)...');
  const secretText = 'p@ssword_sample_123!';
  const encrypted = encrypt(secretText);
  console.log('  -> Encrypted string format:', encrypted);
  assert.ok(encrypted, 'Encrypted output should not be null');
  assert.strictEqual(encrypted.split(':').length, 3, 'Format must be iv:tag:ciphertext');
  
  const decrypted = decrypt(encrypted);
  console.log('  -> Decrypted string:', decrypted);
  assert.strictEqual(decrypted, secretText, 'Decrypted text must match original secret');
  console.log('  ✓ Crypto tests PASSED');

  // 2. Parser Test
  console.log('\n[2/3] Testing Raw Text Regex Parser...');
  const rawInput = `
username: dev_user
password: dev_password_123
login_url: https://mywebsite.com/wp-login.php
email: dev@mywebsite.com
gsocket_user: gsocket_u
gsocket_root: gsocket_r
endpoint:
https://mywebsite.com/wp-admin/license.php
https://mywebsite.com/wp-content/uploads/shell.php
  `;

  const parsed = parseRawText(rawInput);
  console.log('  -> Parsed result:', JSON.stringify(parsed, null, 2));
  assert.strictEqual(parsed.domain, 'mywebsite.com', 'Domain should be auto-extracted');
  assert.strictEqual(parsed.login_user, 'dev_user');
  assert.strictEqual(parsed.login_password, 'dev_password_123');
  assert.strictEqual(parsed.endpoints.length, 2);
  assert.strictEqual(parsed.endpoints[0].is_primary, true, 'First endpoint must be primary');
  assert.strictEqual(parsed.endpoints[1].is_primary, false, 'Second endpoint must not be primary');
  console.log('  ✓ Parser tests PASSED');

  // 3. DNS Resolver Test
  console.log('\n[3/3] Testing Fault-Tolerant DNS Resolver...');
  const validIp = await resolveDomainIp('google.com');
  console.log('  -> google.com IP:', validIp);
  assert.ok(validIp && validIp !== 'UNRESOLVED', 'Valid domain should resolve IP');

  const invalidIp = await resolveDomainIp('invalid-fake-domain-999.invalid');
  console.log('  -> invalid domain IP:', invalidIp);
  assert.strictEqual(invalidIp, 'UNRESOLVED', 'Invalid domain must fall back to UNRESOLVED');
  console.log('  ✓ DNS Resolver tests PASSED');

  console.log('\n========================================');
  console.log('ALL PHASE 1 UNIT TESTS PASSED CLEANLY! ✨');
  console.log('========================================');
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
