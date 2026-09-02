import assert from 'node:assert';
import dotenv from 'dotenv';
import { db } from '../src/db/index';
import { websites, endpoints, sales, saleItems } from '../src/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { POST as loginApi } from '../src/pages/api/auth/login';
import { POST as saveWebsiteApi } from '../src/pages/api/websites/save';
import { GET as getWebsitesApi } from '../src/pages/api/websites/index';
import { GET as getWebsiteDetailApi, DELETE as deleteWebsiteApi } from '../src/pages/api/websites/[id]';
import { POST as liveCheckApi } from '../src/pages/api/websites/live-check';
import { POST as handoverApi } from '../src/pages/api/websites/handover';
import { POST as checkoutApi } from '../src/pages/api/sales/checkout';
import { GET as salesHistoryApi } from '../src/pages/api/sales/index';
import { createSessionToken } from '../src/lib/auth';

dotenv.config();

function createMockContext(urlStr: string, options: { method?: string; body?: any; headers?: Record<string, string>; params?: Record<string, string> } = {}) {
  const url = new URL(urlStr);
  const reqHeaders = new Headers();
  reqHeaders.set('Content-Type', 'application/json');
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      reqHeaders.set(k, v);
    }
  }

  const reqInit: RequestInit = {
    method: options.method || 'GET',
    headers: reqHeaders,
  };
  if (options.body) {
    reqInit.body = JSON.stringify(options.body);
  }

  const request = new Request(url, reqInit);
  const cookies = {
    get: () => ({ value: createSessionToken() }),
    set: () => {},
    delete: () => {},
  } as any;

  return {
    request,
    url,
    params: options.params || {},
    cookies,
    clientAddress: '127.0.0.1',
  } as any;
}

async function runE2EFullAudit() {
  console.log('====================================================');
  console.log('RUNNING FULL END-TO-END SYSTEM INTEGRATION AUDIT');
  console.log('====================================================\n');

  const domainA = 'e2e-master-domain-a.com';
  const domainB = 'e2e-master-domain-b.com';

  // Step 0: Clean existing test data
  console.log('[Step 0] Cleaning existing test records...');
  await db.delete(websites).where(inArray(websites.domain, [domainA, domainB]));

  // Step 1: Authentication API
  console.log('[Step 1] Verifying Login API Authentication & Session Cookies...');
  const loginCtx = createMockContext('http://localhost/api/auth/login', {
    method: 'POST',
    body: { password: process.env.ADMIN_PASSWORD },
  });
  const loginRes = await loginApi(loginCtx);
  assert.strictEqual(loginRes.status, 200, 'Login with correct password must return 200 OK');
  console.log('  ✓ Step 1 Login Auth PASSED');

  // Step 2: Domain Ingestion & Creation
  console.log('[Step 2] Ingesting 2 Domains via Raw Text Parser Engine...');
  const rawTextA = `
username: master_user_a
password: master_secret_a
login_url: https://${domainA}/wp-login.php
endpoint:
https://${domainA}/wp-admin/license.php
https://${domainA}/shell.php
  `;

  const saveCtxA = createMockContext('http://localhost/api/websites/save', {
    method: 'POST',
    body: { raw_text: rawTextA },
  });
  const saveResA = await saveWebsiteApi(saveCtxA);
  assert.strictEqual(saveResA.status, 201);
  const saveJsonA = await saveResA.json();
  const idA = saveJsonA.data.website_id;

  const saveCtxB = createMockContext('http://localhost/api/websites/save', {
    method: 'POST',
    body: {
      domain: domainB,
      login_user: 'master_user_b',
      login_password: 'master_secret_b',
      endpoints: [`https://${domainB}/shell.php`],
    },
  });
  const saveResB = await saveWebsiteApi(saveCtxB);
  assert.strictEqual(saveResB.status, 201);
  const saveJsonB = await saveResB.json();
  const idB = saveJsonB.data.website_id;
  console.log('  ✓ Step 2 Domain Ingestion PASSED (IDs:', idA, idB, ')');

  // Step 3: GET Mass Listing Security Audit
  console.log('[Step 3] Auditing GET Mass Datatable Listing for Secret Masking...');
  const listCtx = createMockContext('http://localhost/api/websites?search=e2e-master');
  const listRes = await getWebsitesApi(listCtx);
  assert.strictEqual(listRes.status, 200);
  const listJson = await listRes.json();
  assert.ok(listJson.data.length >= 2);
  for (const item of listJson.data) {
    assert.strictEqual(item.login_password, undefined, 'Plaintext password must NEVER be in mass list');
    assert.strictEqual(item.gsocket_user, undefined, 'Gsocket user must NEVER be in mass list');
  }
  console.log('  ✓ Step 3 Mass Listing Security PASSED');

  // Step 4: Live Health Check
  console.log('[Step 4] Triggering Live Endpoint Health Check...');
  const liveCtx = createMockContext('http://localhost/api/websites/live-check', {
    method: 'POST',
    body: { website_id: idA },
  });
  const liveRes = await liveCheckApi(liveCtx);
  assert.strictEqual(liveRes.status, 200);
  const liveJson = await liveRes.json();
  assert.strictEqual(liveJson.data.total_checked, 2);
  console.log('  ✓ Step 4 Live Health Check PASSED');

  // Step 5: Detail & Credential Decryption Reveal
  console.log('[Step 5] Testing On-Demand Credential Decryption Reveal...');
  const revealCtx = createMockContext(`http://localhost/api/websites/${idA}?reveal=true`, { params: { id: idA } });
  const revealRes = await getWebsiteDetailApi(revealCtx);
  const revealJson = await revealRes.json();
  assert.strictEqual(revealJson.data.credentials.login_password, 'master_secret_a', 'Revealed password must match original plaintext');
  console.log('  ✓ Step 5 Credential Reveal PASSED');

  // Step 6: Multi-Domain Handover Formatting
  console.log('[Step 6] Verifying Multi-Domain Handover Formatting...');
  const handoverCtx = createMockContext('http://localhost/api/websites/handover', {
    method: 'POST',
    body: { items: [{ website_id: idA }, { website_id: idB }] },
  });
  const handoverRes = await handoverApi(handoverCtx);
  assert.strictEqual(handoverRes.status, 200);
  const handoverJson = await handoverRes.json();
  assert.ok(handoverJson.handover_text.includes(domainA));
  assert.ok(handoverJson.handover_text.includes(domainB));
  console.log('  ✓ Step 6 Handover Formatting PASSED');

  // Step 7: Atomic Bundling Checkout
  console.log('[Step 7] Executing Atomic Bundling Checkout...');
  const checkoutCtx = createMockContext('http://localhost/api/sales/checkout', {
    method: 'POST',
    body: {
      website_ids: [idA, idB],
      total_price: 3200000,
      buyer_note: 'E2E Master Buyer',
    },
  });
  const checkoutRes = await checkoutApi(checkoutCtx);
  assert.strictEqual(checkoutRes.status, 200);
  const checkoutJson = await checkoutRes.json();
  const saleId = checkoutJson.sale_id;
  console.log('  ✓ Step 7 Bundling Checkout PASSED (Sale ID:', saleId, ')');

  // Step 8: Sold Status Safeguards
  console.log('[Step 8] Verifying Sold Domain Safeguards (409 Conflict & 403 Forbidden)...');
  const soldSaveCtx = createMockContext('http://localhost/api/websites/save', {
    method: 'POST',
    body: { domain: domainA, login_user: 'hacker' },
  });
  const soldSaveRes = await saveWebsiteApi(soldSaveCtx);
  assert.strictEqual(soldSaveRes.status, 409, 'Editing sold website must return 409 Conflict');

  const soldDeleteCtx = createMockContext(`http://localhost/api/websites/${idA}`, {
    method: 'DELETE',
    params: { id: idA },
  });
  const soldDeleteRes = await deleteWebsiteApi(soldDeleteCtx);
  assert.strictEqual(soldDeleteRes.status, 403, 'Deleting sold website must return 403 Forbidden');
  console.log('  ✓ Step 8 Sold Safeguards PASSED');

  // Step 9: Sales History Verification
  console.log('[Step 9] Verifying Sales History Listing...');
  const salesHistoryCtx = createMockContext('http://localhost/api/sales');
  const salesHistoryRes = await salesHistoryApi(salesHistoryCtx);
  const salesHistoryJson = await salesHistoryRes.json();
  const recordedSale = salesHistoryJson.data.find((s: any) => s.id === saleId);
  assert.ok(recordedSale, 'Sale transaction must be present in sales history');
  assert.strictEqual(recordedSale.item_count, 2);
  console.log('  ✓ Step 9 Sales History PASSED');

  // Cleanup
  console.log('[Cleanup] Cleaning up master test records...');
  await db.delete(sales).where(eq(sales.id, saleId));
  await db.delete(websites).where(inArray(websites.domain, [domainA, domainB]));

  console.log('\n====================================================');
  console.log('🎉 MASTER E2E INTEGRATION AUDIT PASSED 100%! 🎉');
  console.log('====================================================');
}

runE2EFullAudit().catch((err) => {
  console.error('\n❌ Master E2E audit failed:', err);
  process.exit(1);
});
