import assert from 'node:assert';
import dotenv from 'dotenv';
import { db } from '../src/db/index';
import { websites, endpoints, sales, saleItems } from '../src/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { POST as handoverApi } from '../src/pages/api/websites/handover';
import { POST as checkoutApi } from '../src/pages/api/sales/checkout';
import { GET as getSalesApi } from '../src/pages/api/sales/index';
import { encrypt } from '../src/lib/crypto';
import { createSessionToken } from '../src/lib/auth';

dotenv.config();

function createMockContext(urlStr: string, options: { method?: string; body?: any } = {}) {
  const url = new URL(urlStr);
  const reqHeaders = new Headers();
  reqHeaders.set('Content-Type', 'application/json');

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
    params: {},
    cookies,
    clientAddress: '127.0.0.1',
  } as any;
}

async function runPhase5Tests() {
  console.log('========================================');
  console.log('RUNNING PHASE 5 COMPREHENSIVE TESTS');
  console.log('========================================\n');

  const domain1 = 'phase5-sale-domain-a.org';
  const domain2 = 'phase5-sale-domain-b.org';

  // Cleanup
  await db.delete(websites).where(inArray(websites.domain, [domain1, domain2]));

  // Insert 2 test websites
  const [w1] = await db.insert(websites).values({
    domain: domain1,
    login_url: `https://${domain1}/wp-login.php`,
    login_user: 'admin_a',
    login_password: encrypt('pass_a_123'),
    status: 'active',
  }).returning();

  const [w2] = await db.insert(websites).values({
    domain: domain2,
    login_url: `https://${domain2}/wp-login.php`,
    login_user: 'admin_b',
    login_password: encrypt('pass_b_456'),
    status: 'active',
  }).returning();

  const [ep1] = await db.insert(endpoints).values({
    website_id: w1.id,
    url: `https://${domain1}/shell.php`,
    is_primary: true,
  }).returning();

  const [ep2] = await db.insert(endpoints).values({
    website_id: w2.id,
    url: `https://${domain2}/license.php`,
    is_primary: true,
  }).returning();

  // 1. Handover Formatting Test
  console.log('[1/3] Testing Handover Text Formatter...');
  const handoverCtx = createMockContext('http://localhost/api/websites/handover', {
    method: 'POST',
    body: {
      items: [
        { website_id: w1.id, endpoint_id: ep1.id },
        { website_id: w2.id, endpoint_id: ep2.id },
      ],
    },
  });

  const handoverRes = await handoverApi(handoverCtx);
  assert.strictEqual(handoverRes.status, 200);
  const handoverJson = await handoverRes.json();
  assert.strictEqual(handoverJson.success, true);
  console.log('  -> Handover Text Output:\n' + handoverJson.handover_text);
  assert.ok(handoverJson.handover_text.includes(domain1));
  assert.ok(handoverJson.handover_text.includes('pass_a_123'));
  assert.ok(handoverJson.handover_text.includes(domain2));
  assert.ok(handoverJson.handover_text.includes('=================================================='));
  console.log('  ✓ Handover Formatter test PASSED');

  // 2. Atomic Bundling Checkout Test
  console.log('\n[2/3] Testing Atomic Bundling Checkout...');
  const checkoutCtx = createMockContext('http://localhost/api/sales/checkout', {
    method: 'POST',
    body: {
      website_ids: [w1.id, w2.id],
      total_price: 1500000,
      buyer_note: 'Buyer @telegram_test',
    },
  });

  const checkoutRes = await checkoutApi(checkoutCtx);
  assert.strictEqual(checkoutRes.status, 200);
  const checkoutJson = await checkoutRes.json();
  assert.strictEqual(checkoutJson.success, true);
  const saleId = checkoutJson.sale_id;
  assert.ok(saleId, 'Sale ID must be returned');

  // Verify status in DB turned to 'sold'
  const updatedW1 = (await db.select().from(websites).where(eq(websites.id, w1.id)))[0];
  const updatedW2 = (await db.select().from(websites).where(eq(websites.id, w2.id)))[0];
  assert.strictEqual(updatedW1.status, 'sold', 'Website 1 status must be sold');
  assert.strictEqual(updatedW2.status, 'sold', 'Website 2 status must be sold');

  // Test Sold Safeguard on Checkout
  console.log('  -> Testing Sold Safeguard on Checkout...');
  const repeatCheckoutCtx = createMockContext('http://localhost/api/sales/checkout', {
    method: 'POST',
    body: {
      website_ids: [w1.id],
      total_price: 750000,
    },
  });
  const repeatRes = await checkoutApi(repeatCheckoutCtx);
  assert.strictEqual(repeatRes.status, 409, 'Re-checking out sold domain must return 409 Conflict');
  console.log('  ✓ Atomic Checkout test PASSED');

  // 3. Sales History GET API Test
  console.log('\n[3/3] Testing Sales History GET API...');
  const salesHistoryCtx = createMockContext('http://localhost/api/sales');
  const salesHistoryRes = await getSalesApi(salesHistoryCtx);
  assert.strictEqual(salesHistoryRes.status, 200);
  const salesHistoryJson = await salesHistoryRes.json();
  assert.strictEqual(salesHistoryJson.success, true);
  const foundSale = salesHistoryJson.data.find((s: any) => s.id === saleId);
  assert.ok(foundSale, 'Target sale must be in sales history list');
  assert.strictEqual(foundSale.item_count, 2);
  console.log('  ✓ Sales History test PASSED');

  // Cleanup
  await db.delete(sales).where(eq(sales.id, saleId));
  await db.delete(websites).where(inArray(websites.domain, [domain1, domain2]));

  console.log('\n========================================');
  console.log('ALL PHASE 5 TESTS PASSED CLEANLY! ✨');
  console.log('========================================');
}

runPhase5Tests().catch((err) => {
  console.error('\n❌ Phase 5 test failed:', err);
  process.exit(1);
});
