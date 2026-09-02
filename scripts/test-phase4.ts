import assert from 'node:assert';
import dotenv from 'dotenv';
import { checkSingleEndpointUrl, checkWebsiteEndpoints } from '../src/lib/health-checker';
import { db } from '../src/db/index';
import { websites, endpoints } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { POST as liveCheckApi } from '../src/pages/api/websites/live-check';
import { GET as cronCheckApi } from '../src/pages/api/cron/check-endpoints';
import { createSessionToken } from '../src/lib/auth';

dotenv.config();

function createMockContext(urlStr: string, options: { method?: string; body?: any; headers?: Record<string, string> } = {}) {
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
    params: {},
    cookies,
    clientAddress: '127.0.0.1',
  } as any;
}

async function runPhase4Tests() {
  console.log('========================================');
  console.log('RUNNING PHASE 4 COMPREHENSIVE TESTS');
  console.log('========================================\n');

  // 1. Endpoint Check Status Code Classification
  console.log('[1/3] Testing Health Checker Status Code Classification...');
  
  // Test a real live site (google.com)
  const liveCheck = await checkSingleEndpointUrl('https://google.com');
  console.log('  -> Live check google.com:', liveCheck);
  assert.strictEqual(liveCheck.isActive, true, 'google.com should be active');
  assert.ok(liveCheck.statusCode !== null, 'google.com should return a status code');

  // Test dead endpoint / non-existent URL
  const deadCheck = await checkSingleEndpointUrl('https://non-existent-domain-123456789.invalid/shell.php');
  console.log('  -> Dead check invalid domain:', deadCheck);
  assert.strictEqual(deadCheck.isActive, false, 'Invalid domain should be inactive');
  assert.ok(deadCheck.errorDetail, 'Error detail should be present');
  console.log('  ✓ Status code classification tests PASSED');

  // 2. Live Check API & Sold Exclusion Test
  console.log('\n[2/3] Testing Live Check API & Sold Exclusions...');
  const testDomain = 'phase4-health-test.org';

  // Cleanup
  await db.delete(websites).where(eq(websites.domain, testDomain));

  // Insert test website & endpoint
  const [web] = await db.insert(websites).values({
    domain: testDomain,
    status: 'active',
  }).returning();

  const [ep] = await db.insert(endpoints).values({
    website_id: web.id,
    url: `https://${testDomain}/test.php`,
    is_primary: true,
  }).returning();

  const liveCheckCtx = createMockContext('http://localhost/api/websites/live-check', {
    method: 'POST',
    body: { website_id: web.id },
  });

  const liveRes = await liveCheckApi(liveCheckCtx);
  assert.strictEqual(liveRes.status, 200);
  const liveJson = await liveRes.json();
  assert.strictEqual(liveJson.success, true);
  assert.strictEqual(liveJson.data.endpoints.length, 1);

  // Check DB update
  const updatedEp = (await db.select().from(endpoints).where(eq(endpoints.id, ep.id)))[0];
  assert.ok(updatedEp.last_checked_at !== null, 'last_checked_at timestamp must be updated in DB');

  // Test Sold Domain Exclusion
  await db.update(websites).set({ status: 'sold' }).where(eq(websites.id, web.id));
  const soldLiveCheckCtx = createMockContext('http://localhost/api/websites/live-check', {
    method: 'POST',
    body: { website_id: web.id },
  });
  const soldLiveRes = await liveCheckApi(soldLiveCheckCtx);
  assert.strictEqual(soldLiveRes.status, 409, 'Live check on sold domain must return 409 Conflict');

  // Cleanup
  await db.update(websites).set({ status: 'active' }).where(eq(websites.id, web.id));
  await db.delete(websites).where(eq(websites.id, web.id));

  console.log('  ✓ Live Check API tests PASSED');

  // 3. Background Cron Endpoint Test
  console.log('\n[3/3] Testing Background Cron Endpoint...');
  const cronCtx = createMockContext('http://localhost/api/cron/check-endpoints', {
    method: 'GET',
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });

  const cronRes = await cronCheckApi(cronCtx);
  assert.strictEqual(cronRes.status, 200);
  const cronJson = await cronRes.json();
  assert.strictEqual(cronJson.success, true);
  assert.ok(cronJson.summary, 'Cron summary must be returned');
  console.log('  -> Cron summary:', cronJson.summary);
  console.log('  ✓ Background Cron tests PASSED');

  console.log('\n========================================');
  console.log('ALL PHASE 4 TESTS PASSED CLEANLY! ✨');
  console.log('========================================');
}

runPhase4Tests().catch((err) => {
  console.error('\n❌ Phase 4 test failed:', err);
  process.exit(1);
});
