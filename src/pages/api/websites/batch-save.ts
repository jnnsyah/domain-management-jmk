import type { APIRoute } from 'astro';
import { db } from '@/db';
import { websites, endpoints } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { parseRawTextMulti, type ParsedWebsiteData } from '@/lib/parser';
import { resolveDomainIp } from '@/lib/dns';
import { encrypt } from '@/lib/crypto';
import { dbRetry } from '@/lib/db-utils';

interface BatchResult {
  domain: string;
  action: 'created' | 'updated' | 'skipped';
  reason?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { raw_text } = body;

    if (!raw_text || typeof raw_text !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'raw_text diperlukan untuk batch processing.',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse multi-domain from raw text
    const parsed = parseRawTextMulti(raw_text);

    if (parsed.total === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Tidak ada domain valid ditemukan dalam input.',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results: BatchResult[] = [];
    const errors: string[] = [];

    // Process each domain
    for (const domainData of parsed.domains) {
      try {
        const result = await processSingleDomain(domainData);
        results.push(result);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${domainData.domain}: ${errorMsg}`);
        results.push({
          domain: domainData.domain || 'unknown',
          action: 'skipped',
          reason: errorMsg,
        });
      }
    }

    const created = results.filter((r) => r.action === 'created').length;
    const updated = results.filter((r) => r.action === 'updated').length;
    const skipped = results.filter((r) => r.action === 'skipped').length;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          total: parsed.total,
          created,
          updated,
          skipped,
          results,
          errors: errors.length > 0 ? errors : undefined,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Batch save error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Gagal memproses batch domain.',
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

async function processSingleDomain(data: ParsedWebsiteData): Promise<BatchResult> {
  const targetDomain = data.domain;

  if (!targetDomain) {
    return { domain: 'unknown', action: 'skipped', reason: 'Domain tidak valid' };
  }

  // Check if domain already exists
  const existingWebsite = await dbRetry(() =>
    db.select().from(websites).where(eq(websites.domain, targetDomain))
  );

  // Skip if domain is sold
  if (existingWebsite.length > 0 && existingWebsite[0].status === 'sold') {
    return {
      domain: targetDomain,
      action: 'skipped',
      reason: 'Domain sudah terjual (SOLD)',
    };
  }

  const ipAddress = await resolveDomainIp(targetDomain);

  let websiteId: string;
  let action: 'created' | 'updated';

  if (existingWebsite.length > 0) {
    websiteId = existingWebsite[0].id;
    action = 'updated';

    const updateData: Record<string, any> = {
      ip: ipAddress,
      updated_at: new Date(),
    };

    if (data.login_url) updateData.login_url = data.login_url;
    if (data.email) updateData.email = data.email;
    if (data.login_user) updateData.login_user = data.login_user;
    if (data.login_password) updateData.login_password = encrypt(data.login_password);
    if (data.gsocket_user) updateData.gsocket_user = encrypt(data.gsocket_user);
    if (data.gsocket_root) updateData.gsocket_root = encrypt(data.gsocket_root);

    await dbRetry(() => db.update(websites).set(updateData).where(eq(websites.id, websiteId)));
  } else {
    action = 'created';
    const inserted = await dbRetry(() =>
      db
        .insert(websites)
        .values({
          domain: targetDomain,
          login_url: data.login_url,
          ip: ipAddress,
          email: data.email,
          login_user: data.login_user,
          login_password: encrypt(data.login_password),
          gsocket_user: encrypt(data.gsocket_user),
          gsocket_root: encrypt(data.gsocket_root),
          status: 'active',
        })
        .returning()
    );

    websiteId = inserted[0].id;
  }

  // Insert endpoints if any
  if (data.endpoints.length > 0) {
    const existingEndpoints = await dbRetry(() =>
      db.select().from(endpoints).where(eq(endpoints.website_id, websiteId))
    );
    const existingUrls = new Set(existingEndpoints.map((e) => e.url));
    const hasExistingPrimary = existingEndpoints.some((e) => e.is_primary);

    const endpointsToInsert: { website_id: string; url: string; is_primary: boolean; is_active: boolean }[] = [];
    let isFirst = !hasExistingPrimary;

    for (const ep of data.endpoints) {
      const cleanUrl = ep.url.trim();
      if (!cleanUrl || existingUrls.has(cleanUrl)) continue;

      const isPrimary = ep.is_primary ?? isFirst;
      if (isPrimary) isFirst = false;

      endpointsToInsert.push({
        website_id: websiteId,
        url: cleanUrl,
        is_primary: isPrimary,
        is_active: false,
      });

      existingUrls.add(cleanUrl);
    }

    if (endpointsToInsert.length > 0) {
      await dbRetry(() => db.insert(endpoints).values(endpointsToInsert));
    }
  }

  return { domain: targetDomain, action };
}
