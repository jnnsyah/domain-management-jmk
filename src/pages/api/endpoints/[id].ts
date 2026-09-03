import type { APIRoute } from 'astro';
import { db } from '@/db';
import { websites, endpoints } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { dbRetry } from '@/lib/db-utils';

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'ID endpoint tidak valid.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const existingList = await dbRetry(() => db.select().from(endpoints).where(eq(endpoints.id, id)));
    if (existingList.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const targetEp = existingList[0];
    const body = await request.json().catch(() => ({}));

    // Determine target primary state: toggle if not explicitly provided in body
    const nextPrimaryState = typeof body.is_primary === 'boolean' ? body.is_primary : !targetEp.is_primary;

    if (nextPrimaryState) {
      // Set all endpoints for this website to is_primary = false first
      await dbRetry(() =>
        db
          .update(endpoints)
          .set({ is_primary: false })
          .where(eq(endpoints.website_id, targetEp.website_id))
      );

      // Set target endpoint as primary
      await dbRetry(() =>
        db
          .update(endpoints)
          .set({ is_primary: true })
          .where(eq(endpoints.id, id))
      );
    } else {
      // Unset primary for target endpoint
      await dbRetry(() =>
        db
          .update(endpoints)
          .set({ is_primary: false })
          .where(eq(endpoints.id, id))
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        is_primary: nextPrimaryState,
        message: nextPrimaryState
          ? 'Endpoint berhasil dijadikan primary.'
          : 'Status primary endpoint berhasil dilepas (unset).',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Toggle primary endpoint error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Gagal mengubah status primary endpoint.' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'ID endpoint tidak valid.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const existingList = await dbRetry(() => db.select().from(endpoints).where(eq(endpoints.id, id)));
    if (existingList.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const targetEp = existingList[0];
    const websiteId = targetEp.website_id;
    const wasPrimary = targetEp.is_primary;

    // Delete endpoint
    await dbRetry(() => db.delete(endpoints).where(eq(endpoints.id, id)));

    // If deleted endpoint was primary, assign primary flag to another endpoint if available
    if (wasPrimary) {
      const remainingList = await dbRetry(() => db.select().from(endpoints).where(eq(endpoints.website_id, websiteId)));
      if (remainingList.length > 0) {
        await dbRetry(() =>
          db
            .update(endpoints)
            .set({ is_primary: true })
            .where(eq(endpoints.id, remainingList[0].id))
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Endpoint berhasil dihapus.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Delete endpoint error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Gagal menghapus endpoint.' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
