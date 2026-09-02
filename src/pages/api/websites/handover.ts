import type { APIRoute } from 'astro';
import { db } from '@/db';
import { websites, endpoints } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { items = [] } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Daftar website item handover wajib diisi.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const websiteIds = items.map((it: any) => typeof it === 'string' ? it : it.website_id).filter(Boolean);
    if (websiteIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'ID website tidak valid.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const webList = await db.select().from(websites).where(inArray(websites.id, websiteIds));
    const webMap = new Map(webList.map(w => [w.id, w]));

    const epList = await db.select().from(endpoints).where(inArray(endpoints.website_id, websiteIds));
    const epMap = new Map<string, any[]>();
    for (const ep of epList) {
      const list = epMap.get(ep.website_id) || [];
      list.push(ep);
      epMap.set(ep.website_id, list);
    }

    const formattedBlocks: string[] = [];

    for (const item of items) {
      const wId = typeof item === 'string' ? item : item.website_id;
      const targetEpId = typeof item === 'object' ? item.endpoint_id : null;

      const web = webMap.get(wId);
      if (!web) continue;

      const allEps = epMap.get(wId) || [];
      let selectedEp = null;
      if (targetEpId) {
        selectedEp = allEps.find(e => e.id === targetEpId);
      }
      if (!selectedEp) {
        selectedEp = allEps.find(e => e.is_primary) || allEps[0] || null;
      }

      const pass = decrypt(web.login_password) || '-';
      const gsUser = decrypt(web.gsocket_user);
      const gsRoot = decrypt(web.gsocket_root);

      const blockLines = [
        `Domain    : ${web.domain}`,
        `Login URL : ${web.login_url || '-'}`,
        `Username  : ${web.login_user || '-'}`,
        `Password  : ${pass}`,
        `Endpoint  : ${selectedEp ? selectedEp.url : '-'}`,
      ];

      if (gsUser) blockLines.push(`Gsocket U : ${gsUser}`);
      if (gsRoot) blockLines.push(`Gsocket R : ${gsRoot}`);

      formattedBlocks.push(blockLines.join('\n'));
    }

    const handoverText = formattedBlocks.join('\n==================================================\n');

    return new Response(
      JSON.stringify({
        success: true,
        handover_text: handoverText,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Handover format error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Gagal memformat data handover.' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
