import type { APIRoute } from 'astro';
import { db } from '@/db';
import { websites, endpoints } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { parseRawText } from '@/lib/parser';
import { resolveDomainIp } from '@/lib/dns';
import { encrypt } from '@/lib/crypto';
import { dbRetry } from '@/lib/db-utils';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { raw_text, domain: inputDomain, login_url, email, login_user, login_password, gsocket_user, gsocket_root, endpoints: inputEndpoints } = body;

    let targetDomain = inputDomain ? inputDomain.trim() : '';
    let targetLoginUrl = login_url ? login_url.trim() : null;
    let targetEmail = email ? email.trim() : null;
    let targetLoginUser = login_user ? login_user.trim() : null;
    let targetLoginPassword = login_password ? login_password.trim() : null;
    let targetGsocketUser = gsocket_user ? gsocket_user.trim() : null;
    let targetGsocketRoot = gsocket_root ? gsocket_root.trim() : null;
    let targetEndpoints: { url: string; is_primary: boolean }[] = Array.isArray(inputEndpoints)
      ? inputEndpoints.map((ep: any) => typeof ep === 'string' ? { url: ep, is_primary: false } : ep)
      : [];

    if (raw_text && typeof raw_text === 'string') {
      const parsed = parseRawText(raw_text);
      if (parsed.domain) targetDomain = parsed.domain;
      if (parsed.login_url) targetLoginUrl = parsed.login_url;
      if (parsed.email) targetEmail = parsed.email;
      if (parsed.login_user) targetLoginUser = parsed.login_user;
      if (parsed.login_password) targetLoginPassword = parsed.login_password;
      if (parsed.gsocket_user) targetGsocketUser = parsed.gsocket_user;
      if (parsed.gsocket_root) targetGsocketRoot = parsed.gsocket_root;

      if (parsed.endpoints && parsed.endpoints.length > 0) {
        targetEndpoints = parsed.endpoints;
      }
    }

    if (!targetDomain) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Domain name tidak ditemukan dalam input. Harap sertakan nama domain atau endpoint valid.',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const existingWebsite = await dbRetry(() => db.select().from(websites).where(eq(websites.domain, targetDomain)));

    if (existingWebsite.length > 0 && existingWebsite[0].status === 'sold') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'CONFLICT',
            message: `Domain '${targetDomain}' sudah ditandai TERJUAL (SOLD). Data domain terjual tidak dapat diubah atau ditimpa.`,
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
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

      if (targetLoginUrl) updateData.login_url = targetLoginUrl;
      if (targetEmail) updateData.email = targetEmail;
      if (targetLoginUser) updateData.login_user = targetLoginUser;
      if (targetLoginPassword) updateData.login_password = encrypt(targetLoginPassword);
      if (targetGsocketUser) updateData.gsocket_user = encrypt(targetGsocketUser);
      if (targetGsocketRoot) updateData.gsocket_root = encrypt(targetGsocketRoot);

      await dbRetry(() => db.update(websites).set(updateData).where(eq(websites.id, websiteId)));
    } else {
      action = 'created';
      const inserted = await dbRetry(() =>
        db.insert(websites).values({
          domain: targetDomain,
          login_url: targetLoginUrl,
          ip: ipAddress,
          email: targetEmail,
          login_user: targetLoginUser,
          login_password: encrypt(targetLoginPassword),
          gsocket_user: encrypt(targetGsocketUser),
          gsocket_root: encrypt(targetGsocketRoot),
          status: 'active',
        }).returning()
      );

      websiteId = inserted[0].id;
    }

    if (targetEndpoints.length > 0) {
      const existingEndpoints = await dbRetry(() => db.select().from(endpoints).where(eq(endpoints.website_id, websiteId)));
      const existingUrls = new Set(existingEndpoints.map((e) => e.url));
      const hasExistingPrimary = existingEndpoints.some((e) => e.is_primary);

      const endpointsToInsert = [];
      let isFirst = !hasExistingPrimary;

      for (const ep of targetEndpoints) {
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

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          action,
          website_id: websiteId,
          domain: targetDomain,
          ip: ipAddress,
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Save website error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Gagal menyimpan data website.',
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
