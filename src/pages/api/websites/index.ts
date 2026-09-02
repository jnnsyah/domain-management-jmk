import type { APIRoute } from 'astro';
import { db } from '@/db';
import { websites, endpoints } from '@/db/schema';
import { eq, ilike, or, and, desc, asc } from 'drizzle-orm';

async function fetchDbWithRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= retries) throw err;
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error('Database fetch failed');
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const params = url.searchParams;
    const page = Math.max(1, parseInt(params.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '10', 10)));
    const search = (params.get('search') || '').trim();
    const statusFilter = params.get('status') || 'all';
    const endpointStatusFilter = params.get('endpoint_status') || 'all';
    const sortField = params.get('sort') || 'created_at';
    const sortOrder = params.get('order') || 'desc';

    // Fetch websites & endpoints with automatic retry for resilience
    const [allDbWebsites, allDbEndpoints] = await fetchDbWithRetry(() =>
      Promise.all([db.select().from(websites), db.select().from(endpoints)])
    );

    // Map endpoints by website_id
    const endpointsByWebsite = new Map<string, any[]>();
    for (const ep of allDbEndpoints) {
      const list = endpointsByWebsite.get(ep.website_id) || [];
      list.push(ep);
      endpointsByWebsite.set(ep.website_id, list);
    }

    // Calculate primary endpoint OFF count
    const primaryOffCount = allDbWebsites.filter(w => {
      const eps = endpointsByWebsite.get(w.id) || [];
      const primaryEp = eps.find(e => e.is_primary) || eps[0];
      return primaryEp && !primaryEp.is_active;
    }).length;

    const stats = {
      total: allDbWebsites.length,
      active: allDbWebsites.filter(w => w.status === 'active').length,
      sold: allDbWebsites.filter(w => w.status === 'sold').length,
      primary_off: primaryOffCount,
    };

    // Filter in-memory
    let filteredWebsites = allDbWebsites;
    if (search) {
      const s = search.toLowerCase();
      filteredWebsites = filteredWebsites.filter(
        w =>
          w.domain.toLowerCase().includes(s) ||
          (w.ip && w.ip.toLowerCase().includes(s)) ||
          (w.login_user && w.login_user.toLowerCase().includes(s))
      );
    }

    if (statusFilter === 'active' || statusFilter === 'sold') {
      filteredWebsites = filteredWebsites.filter(w => w.status === statusFilter);
    }

    // Filter by endpoint_status
    if (endpointStatusFilter === 'active') {
      filteredWebsites = filteredWebsites.filter(w => {
        const eps = endpointsByWebsite.get(w.id) || [];
        return eps.some(e => e.is_active);
      });
    } else if (endpointStatusFilter === 'inactive') {
      filteredWebsites = filteredWebsites.filter(w => {
        const eps = endpointsByWebsite.get(w.id) || [];
        return eps.length === 0 || eps.every(e => !e.is_active);
      });
    }

    // Sort in-memory
    filteredWebsites.sort((a, b) => {
      let valA: any = a.created_at;
      let valB: any = b.created_at;
      if (sortField === 'domain') {
        valA = a.domain;
        valB = b.domain;
      } else if (sortField === 'updated_at') {
        valA = a.updated_at;
        valB = b.updated_at;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const totalItems = filteredWebsites.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const offset = (page - 1) * limit;
    const paginatedWebsites = filteredWebsites.slice(offset, offset + limit);

    // Format response
    const formattedData = paginatedWebsites.map(w => {
      const eps = endpointsByWebsite.get(w.id) || [];
      const primaryEp = eps.find(e => e.is_primary) || eps[0] || null;

      return {
        id: w.id,
        domain: w.domain,
        login_url: w.login_url,
        ip: w.ip,
        email: w.email,
        login_user: w.login_user,
        has_gsocket_root: Boolean(w.gsocket_root),
        status: w.status,
        primary_endpoint: primaryEp
          ? {
              id: primaryEp.id,
              url: primaryEp.url,
              status_code: primaryEp.status_code,
              is_active: primaryEp.is_active,
              error_detail: primaryEp.error_detail,
              last_checked_at: primaryEp.last_checked_at,
            }
          : null,
        total_endpoints: eps.length,
        created_at: w.created_at,
        updated_at: w.updated_at,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        data: formattedData,
        pagination: {
          page,
          limit,
          total_items: totalItems,
          total_pages: totalPages,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Get websites error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: 'Gagal mengambil daftar website.',
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
