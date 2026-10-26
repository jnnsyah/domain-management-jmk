import type { APIRoute } from 'astro';
import { db } from '@/db';
import { websites } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchDomainAge } from '@/lib/domain-age';

export const POST: APIRoute = async ({ params, request }) => {
  const { id } = params;

  if (!id) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'MISSING_ID', message: 'Website ID diperlukan.' },
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get domain from database
    const [website] = await db.select().from(websites).where(eq(websites.id, id)).limit(1);

    if (!website) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Website tidak ditemukan.' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch domain age from API
    const result = await fetchDomainAge(website.domain);

    if (!result.ok || !result.data) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || { code: 'FETCH_FAILED', message: 'Gagal mengambil data domain age.' },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update database with domain age data
    await db
      .update(websites)
      .set({
        created_date: new Date(result.data.created),
        expiry_date: new Date(result.data.expires),
        domain_age_days: result.data.ageDays,
        last_age_check: new Date(),
        updated_at: new Date(),
      })
      .where(eq(websites.id, id));

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          domain: result.data.domain,
          created_date: result.data.created,
          expiry_date: result.data.expires,
          domain_age_days: result.data.ageDays,
          domain_age_years: result.data.ageYears,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[DOMAIN_AGE] Update error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Terjadi kesalahan server.',
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
