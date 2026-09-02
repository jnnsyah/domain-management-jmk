import type { APIRoute } from 'astro';
import { checkWebsiteEndpoints } from '@/lib/health-checker';
import { db } from '@/db';
import { websites } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { website_id } = body;

    if (!website_id || typeof website_id !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'website_id wajib diisi.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const existingList = await db.select().from(websites).where(eq(websites.id, website_id));
    if (existingList.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Website tidak ditemukan.' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const website = existingList[0];
    if (website.status === 'sold') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'CONFLICT', message: 'Domain berstatus sold diabaikan dari pengecekan kesehatan.' },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results = await checkWebsiteEndpoints(website_id);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          website_id,
          domain: website.domain,
          total_checked: results.length,
          endpoints: results,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Live check error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Gagal melakukan live check endpoint.' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
