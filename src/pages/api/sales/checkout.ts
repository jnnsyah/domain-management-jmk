import type { APIRoute } from 'astro';
import { db } from '@/db';
import { websites, sales, saleItems } from '@/db/schema';
import { inArray, eq } from 'drizzle-orm';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { website_ids = [], total_price, buyer_note, custom_prices = {} } = body;

    if (!Array.isArray(website_ids) || website_ids.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Daftar website_ids wajib diisi.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const priceNum = typeof total_price === 'string' ? parseFloat(total_price) : total_price;
    if (typeof priceNum !== 'number' || isNaN(priceNum) || priceNum < 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Total harga harus berupa angka valid.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Atomic Checkout Validation & Execution (PRD Section 8 & 9)
    const targetWebsites = await db.select().from(websites).where(inArray(websites.id, website_ids));

    if (targetWebsites.length !== website_ids.length) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Satu atau lebih website target tidak ditemukan.' },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Safeguard: Reject if any website is already sold
    const alreadySold = targetWebsites.filter(w => w.status === 'sold');
    if (alreadySold.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'CONFLICT',
            message: `Domain '${alreadySold.map(w => w.domain).join(', ')}' sudah terjual sebelumnya.`,
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Create Sales record
    const [insertedSale] = await db.insert(sales).values({
      total_price: priceNum.toFixed(2),
      buyer_note: buyer_note ? buyer_note.trim() : null,
    }).returning();

    // 2. Insert Sale Items
    const saleItemValues = website_ids.map(wId => ({
      sale_id: insertedSale.id,
      website_id: wId,
      custom_price: custom_prices[wId] ? parseFloat(custom_prices[wId]).toFixed(2) : null,
    }));

    await db.insert(saleItems).values(saleItemValues);

    // 3. Mark target websites as 'sold'
    await db.update(websites)
      .set({ status: 'sold', updated_at: new Date() })
      .where(inArray(websites.id, website_ids));

    return new Response(
      JSON.stringify({
        success: true,
        sale_id: insertedSale.id,
        message: 'Penjualan bundling berhasil diproses.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Checkout sales error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Gagal memproses transaksi checkout penjualan.' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
