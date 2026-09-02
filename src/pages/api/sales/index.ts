import type { APIRoute } from 'astro';
import { db } from '@/db';
import { sales, saleItems, websites } from '@/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { dbRetry } from '@/lib/db-utils';

export const GET: APIRoute = async ({ url }) => {
  try {
    const params = url.searchParams;
    const page = Math.max(1, parseInt(params.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '10', 10)));
    const search = (params.get('search') || '').trim().toLowerCase();
    const timePreset = params.get('time_preset') || 'all';
    const dateFrom = params.get('date_from');
    const dateTo = params.get('date_to');

    return await dbRetry(async () => {
      const allSales = await db.select().from(sales).orderBy(desc(sales.sold_at));
      const saleIds = allSales.map(s => s.id);

      let allItems: any[] = [];
      if (saleIds.length > 0) {
        allItems = await db.select().from(saleItems).where(inArray(saleItems.sale_id, saleIds));
      }

      const websiteIds = Array.from(new Set(allItems.map(it => it.website_id)));
      let allWebsites: any[] = [];
      if (websiteIds.length > 0) {
        allWebsites = await db.select().from(websites).where(inArray(websites.id, websiteIds));
      }
      const webMap = new Map(allWebsites.map(w => [w.id, w]));

      const itemsBySale = new Map<string, any[]>();
      for (const it of allItems) {
        const list = itemsBySale.get(it.sale_id) || [];
        const web = webMap.get(it.website_id);
        list.push({
          id: it.id,
          website_id: it.website_id,
          domain: web ? web.domain : 'Unknown',
          custom_price: it.custom_price,
        });
        itemsBySale.set(it.sale_id, list);
      }

      let formattedData = allSales.map(s => ({
        id: s.id,
        total_price: s.total_price,
        buyer_note: s.buyer_note,
        sold_at: s.sold_at,
        items: itemsBySale.get(s.id) || [],
        item_count: (itemsBySale.get(s.id) || []).length,
      }));

      // Time Filter Presets & Custom Date Range Logic
      const now = new Date();
      if (timePreset === 'today') {
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        formattedData = formattedData.filter(s => new Date(s.sold_at).getTime() >= startToday);
      } else if (timePreset === '7days') {
        const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
        formattedData = formattedData.filter(s => new Date(s.sold_at).getTime() >= sevenDaysAgo);
      } else if (timePreset === '30days') {
        const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
        formattedData = formattedData.filter(s => new Date(s.sold_at).getTime() >= thirtyDaysAgo);
      } else if (timePreset === 'this_month') {
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        formattedData = formattedData.filter(s => new Date(s.sold_at).getTime() >= startMonth);
      } else if (timePreset === 'custom') {
        if (dateFrom) {
          const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
          if (!isNaN(fromTime)) {
            formattedData = formattedData.filter(s => new Date(s.sold_at).getTime() >= fromTime);
          }
        }
        if (dateTo) {
          const toTime = new Date(`${dateTo}T23:59:59`).getTime();
          if (!isNaN(toTime)) {
            formattedData = formattedData.filter(s => new Date(s.sold_at).getTime() <= toTime);
          }
        }
      }

      // Search Filter
      if (search) {
        formattedData = formattedData.filter(s => {
          const matchBuyer = s.buyer_note?.toLowerCase().includes(search);
          const matchDomain = s.items.some((it: any) => it.domain.toLowerCase().includes(search));
          return matchBuyer || matchDomain;
        });
      }

      const totalItems = formattedData.length;
      const totalPages = Math.ceil(totalItems / limit) || 1;
      const offset = (page - 1) * limit;

      const paginatedSales = formattedData.slice(offset, offset + limit);

      return new Response(
        JSON.stringify({
          success: true,
          data: paginatedSales,
          pagination: {
            page,
            limit,
            total_items: totalItems,
            total_pages: totalPages,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
  } catch (err) {
    console.error('Get sales list error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Gagal mengambil riwayat penjualan.' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
