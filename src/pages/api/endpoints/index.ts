import type { APIRoute } from 'astro';
import { db } from '@/db';
import { websites, endpoints } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { website_id, url, is_primary = false } = body;

    if (!website_id || !url || typeof url !== 'string' || !url.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'website_id dan URL endpoint wajib diisi.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check website existence
    const existingWebsites = await db.select().from(websites).where(eq(websites.id, website_id));
    if (existingWebsites.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Website target tidak ditemukan.' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const website = existingWebsites[0];
    if (website.status === 'sold') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'CONFLICT', message: 'Domain sudah terjual, tidak dapat menambah endpoint.' },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cleanUrl = url.trim();

    // Check duplicate endpoint for this website
    const duplicateList = await db
      .select()
      .from(endpoints)
      .where(and(eq(endpoints.website_id, website_id), eq(endpoints.url, cleanUrl)));

    if (duplicateList.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'CONFLICT', message: 'URL Endpoint sudah terdaftar pada domain ini.' },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if website has existing endpoints
    const existingEpList = await db.select().from(endpoints).where(eq(endpoints.website_id, website_id));
    const shouldBePrimary = is_primary || existingEpList.length === 0;

    if (shouldBePrimary && existingEpList.length > 0) {
      // Clear previous primary
      await db
        .update(endpoints)
        .set({ is_primary: false })
        .where(eq(endpoints.website_id, website_id));
    }

    const [newEndpoint] = await db
      .insert(endpoints)
      .values({
        website_id,
        url: cleanUrl,
        is_primary: shouldBePrimary,
        is_active: false,
      })
      .returning();

    return new Response(
      JSON.stringify({
        success: true,
        data: newEndpoint,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Add endpoint error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Gagal menambahkan endpoint baru.' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
