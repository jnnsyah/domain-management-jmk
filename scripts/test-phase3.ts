import assert from 'node:assert';
import dotenv from 'dotenv';
import { db } from '../src/db/index';
import { websites, endpoints } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { POST as saveWebsite } from '../src/pages/api/websites/save';
import { GET as getWebsites } from '../src/pages/api/websites/index';
import { GET as getWebsiteDetail, PUT as updateWebsite, DELETE as deleteWebsite } from '../src/pages/api/websites/[id]';
import { POST as addEndpoint } from '../src/pages/api/endpoints/index';
import { PUT as setPrimaryEndpoint, DELETE as deleteEndpoint } from '../src/pages/api/endpoints/[id]';
import { createSessionToken } from '../src/lib/auth';

dotenv.config();

function createMockContext(urlStr: string, options: { method?: string; body?: any; params?: Record<string, string> } = {}) {
  const url = new URL(urlStr);
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  const reqInit: RequestInit = {
    method: options.method || 'GET',
    headers,
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
    redirect: (path: string) => new Response(null, { status: 302, headers: { Location: path } }),
  } as any;
}

async function runPhase3Tests() {
  console.log('========================================');
  console.log('RUNNING PHASE 3 COMPREHENSIVE TESTS');
  console.log('========================================\n');

  const testDomain = 'phase3-testing-domain.org';

  // Clean up any existing test records first
  const existingTest = await db.select().from(websites).where(eq(websites.domain, testDomain));
  if (existingTest.length > 0) {
    await db.delete(websites).where(eq(websites.domain, testDomain));
  }

  // 1. Test Website Ingestion & UPSERT Creation
  console.log('[1/5] Testing Website Ingestion & Creation...');
  const rawInput = `
username: phase3_user
password: phase3_secret_pass
login_url: https://${testDomain}/wp-login.php
email: admin@${testDomain}
gsocket_user: gs_u1
gsocket_root: gs_r1
endpoint:
https://${testDomain}/wp-admin/license.php
https://${testDomain}/shell1.php
  `;

  const saveCtx1 = createMockContext('http://localhost/api/websites/save', {
    method: 'POST',
    body: { raw_text: rawInput },
  });

  const saveRes1 = await saveWebsite(saveCtx1);
  assert.strictEqual(saveRes1.status, 201, 'New domain creation should return 201 Created');
  const saveJson1 = await saveRes1.json();
  assert.strictEqual(saveJson1.success, true);
  assert.strictEqual(saveJson1.data.action, 'created');

  const websiteId = saveJson1.data.website_id;
  console.log('  -> Website created with ID:', websiteId);

  // Verify primary endpoint assignment
  const epList1 = await db.select().from(endpoints).where(eq(endpoints.website_id, websiteId));
  assert.strictEqual(epList1.length, 2, 'Should have inserted 2 endpoints');
  assert.strictEqual(epList1[0].is_primary, true, 'First endpoint must be primary');
  assert.strictEqual(epList1[1].is_primary, false, 'Second endpoint must not be primary');
  console.log('  ✓ Ingestion & Creation test PASSED');

  // 2. Test UPSERT Strategy (Update credentials & Append endpoints without wiping)
  console.log('\n[2/5] Testing UPSERT Strategy (Update & Append)...');
  const updateRawInput = `
username: phase3_updated_user
password: phase3_new_password
endpoint:
https://${testDomain}/shell2.php
  `;

  const saveCtx2 = createMockContext('http://localhost/api/websites/save', {
    method: 'POST',
    body: { raw_text: updateRawInput },
  });

  const saveRes2 = await saveWebsite(saveCtx2);
  assert.strictEqual(saveRes2.status, 200, 'UPSERT update should return 200 OK');
  const saveJson2 = await saveRes2.json();
  assert.strictEqual(saveJson2.data.action, 'updated');

  const epList2 = await db.select().from(endpoints).where(eq(endpoints.website_id, websiteId));
  assert.strictEqual(epList2.length, 3, 'New endpoint should be appended (total 3)');
  console.log('  ✓ UPSERT Update test PASSED');

  // 3. Test GET Datatable Listing & Security (Secrets hidden)
  console.log('\n[3/5] Testing GET Datatable Listing & Secret Protection...');
  const listCtx = createMockContext(`http://localhost/api/websites?search=${testDomain}`);
  const listRes = await getWebsites(listCtx);
  assert.strictEqual(listRes.status, 200);
  const listJson = await listRes.json();
  assert.strictEqual(listJson.success, true);
  assert.ok(listJson.data.length >= 1);
  const listedWeb = listJson.data.find((w: any) => w.domain === testDomain);
  assert.ok(listedWeb, 'Target domain must exist in list');
  assert.strictEqual(listedWeb.login_password, undefined, 'Plaintext password must NOT be in mass listing');
  assert.strictEqual(listedWeb.gsocket_user, undefined, 'Gsocket user must NOT be in mass listing');
  console.log('  ✓ GET Datatable listing test PASSED');

  // 4. Test Single Detail & Credential Reveal Toggle
  console.log('\n[4/5] Testing Single Website Detail & Decrypt Reveal...');
  const detailMaskedCtx = createMockContext(`http://localhost/api/websites/${websiteId}`, { params: { id: websiteId } });
  const detailMaskedRes = await getWebsiteDetail(detailMaskedCtx);
  const detailMaskedJson = await detailMaskedRes.json();
  assert.strictEqual(detailMaskedJson.data.credentials.login_password, '••••••••', 'Masked view should show bullet mask');

  const detailRevealCtx = createMockContext(`http://localhost/api/websites/${websiteId}?reveal=true`, { params: { id: websiteId } });
  const detailRevealRes = await getWebsiteDetail(detailRevealCtx);
  const detailRevealJson = await detailRevealRes.json();
  assert.strictEqual(detailRevealJson.data.credentials.login_password, 'phase3_new_password', 'Revealed password must decrypt to plaintext');
  console.log('  ✓ Detail & Decrypt reveal test PASSED');

  // 5. Test Endpoint Management (Set Primary & Delete)
  console.log('\n[5/5] Testing Endpoint Set Primary & Delete...');
  const targetEpId = epList2[1].id; // Second endpoint
  const primaryCtx = createMockContext(`http://localhost/api/endpoints/${targetEpId}`, {
    method: 'PUT',
    params: { id: targetEpId },
  });
  const primaryRes = await setPrimaryEndpoint(primaryCtx);
  assert.strictEqual(primaryRes.status, 200);

  const updatedEpList = await db.select().from(endpoints).where(eq(endpoints.website_id, websiteId));
  const newPrimary = updatedEpList.find(e => e.id === targetEpId);
  assert.strictEqual(newPrimary?.is_primary, true, 'Second endpoint should now be primary');

  // Test Sold Status Safeguard
  console.log('  -> Testing Sold Status Safeguards (409 Conflict & 403 Forbidden)...');
  await db.update(websites).set({ status: 'sold' }).where(eq(websites.id, websiteId));

  const soldSaveCtx = createMockContext('http://localhost/api/websites/save', {
    method: 'POST',
    body: { domain: testDomain, login_user: 'should_fail' },
  });
  const soldSaveRes = await saveWebsite(soldSaveCtx);
  assert.strictEqual(soldSaveRes.status, 409, 'Updating sold website must return 409 Conflict');

  const soldDeleteCtx = createMockContext(`http://localhost/api/websites/${websiteId}`, {
    method: 'DELETE',
    params: { id: websiteId },
  });
  const soldDeleteRes = await deleteWebsite(soldDeleteCtx);
  assert.strictEqual(soldDeleteRes.status, 403, 'Deleting sold website must return 403 Forbidden');

  // Cleanup: Reset status to active and delete test website
  await db.update(websites).set({ status: 'active' }).where(eq(websites.id, websiteId));
  await db.delete(websites).where(eq(websites.id, websiteId));

  console.log('  ✓ Endpoint management & Sold safeguards tests PASSED');

  console.log('\n========================================');
  console.log('ALL PHASE 3 TESTS PASSED CLEANLY! ✨');
  console.log('========================================');
}

runPhase3Tests().catch((err) => {
  console.error('\n❌ Phase 3 test failed:', err);
  process.exit(1);
});
