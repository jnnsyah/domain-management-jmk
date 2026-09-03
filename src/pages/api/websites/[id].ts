import type { APIRoute } from 'astro';
import { db } from '@/db';
import { websites, endpoints } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt, encrypt } from '@/lib/crypto';
import { dbRetry } from '@/lib/db-utils';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'ID website tidak valid.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const [result, websiteEndpoints] = await dbRetry(() =>
      Promise.all([
        db.select().from(websites).where(eq(websites.id, id)),
        db.select().from(endpoints).where(eq(endpoints.website_id, id)),
      ])
    );

    if (result.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Website tidak ditemukan.' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const website = result[0];

    const credentials = {
      login_password: decrypt(website.login_password),
      gsocket_user: decrypt(website.gsocket_user),
      gsocket_root: decrypt(website.gsocket_root),
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          id: website.id,
          domain: website.domain,
          login_url: website.login_url,
          ip: website.ip,
          email: website.email,
          login_user: website.login_user,
          credentials,
          status: website.status,
          created_at: website.created_at,
          updated_at: website.updated_at,
          endpoints: websiteEndpoints,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Get website detail error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Gagal mengambil detail website.' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'ID website tidak valid.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const existing = await dbRetry(() => db.select().from(websites).where(eq(websites.id, id)));
    if (existing.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Website tidak ditemukan.' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const website = existing[0];
    if (website.status === 'sold') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'CONFLICT', message: 'Domain sudah terjual, tidak dapat diperbarui.' },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { login_url, email, login_user, login_password, gsocket_user, gsocket_root, status } = body;

    const updatePayload: Record<string, any> = {
      updated_at: new Date(),
    };

    if (status !== undefined && ['active', 'reject'].includes(status)) {
      updatePayload.status = status;
    }
    if (login_url !== undefined) updatePayload.login_url = login_url ? login_url.trim() : null;
    if (email !== undefined) updatePayload.email = email ? email.trim() : null;
    if (login_user !== undefined) updatePayload.login_user = login_user ? login_user.trim() : null;
    if (login_password !== undefined && login_password !== '') {
      updatePayload.login_password = encrypt(login_password.trim());
    }
    if (gsocket_user !== undefined && gsocket_user !== '') {
      updatePayload.gsocket_user = encrypt(gsocket_user.trim());
    }
    if (gsocket_root !== undefined && gsocket_root !== '') {
      updatePayload.gsocket_root = encrypt(gsocket_root.trim());
    }

    await dbRetry(() => db.update(websites).set(updatePayload).where(eq(websites.id, id)));

    return new Response(
      JSON.stringify({ success: true, message: 'Data website berhasil diperbarui.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Update website error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Gagal memperbarui website.' },
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
          error: { code: 'VALIDATION_ERROR', message: 'ID website tidak valid.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const existing = await dbRetry(() => db.select().from(websites).where(eq(websites.id, id)));
    if (existing.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Website tidak ditemukan.' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const website = existing[0];
    if (website.status === 'sold') {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Domain yang sudah terjual dilarang dihapus untuk menjaga integritas transaksi.',
          },
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await dbRetry(() => db.delete(websites).where(eq(websites.id, id)));

    return new Response(
      JSON.stringify({ success: true, message: 'Website berhasil dihapus.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Delete website error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Gagal menghapus website.' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
