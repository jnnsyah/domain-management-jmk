import type { APIRoute } from 'astro';
import { db } from '@/db';
import { websites } from '@/db/schema';
import { inArray, eq, and, ne } from 'drizzle-orm';
import { dbRetry } from '@/lib/db-utils';

export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { website_ids, status } = body;

    if (!Array.isArray(website_ids) || website_ids.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'website_ids wajib berupa array non-kosong.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!['active', 'reject'].includes(status)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: "status harus 'active' atau 'reject'." },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update status for non-sold websites
    await dbRetry(() =>
      db
        .update(websites)
        .set({ status, updated_at: new Date() })
        .where(and(inArray(websites.id, website_ids), ne(websites.status, 'sold')))
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `${website_ids.length} domain berhasil diperbarui statusnya menjadi '${status}'.`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Bulk update status error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Gagal memperbarui status domain secara massal.' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
