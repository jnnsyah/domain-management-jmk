import { db } from '@/db';
import { websites, endpoints } from '@/db/schema';
import { eq, inArray, and, asc, sql } from 'drizzle-orm';
import { dbRetry } from './db-utils';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 1000;

export interface CheckResult {
  endpoint_id: string;
  url: string;
  status_code: number | null;
  is_active: boolean;
  error_detail: string | null;
}

/**
 * Performs HTTP HEAD check with GET fallback and 1x retry on timeout
 */
export async function checkSingleEndpointUrl(urlStr: string): Promise<{ statusCode: number | null; isActive: boolean; errorDetail: string | null }> {
  async function performFetch(method: 'HEAD' | 'GET') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(urlStr, {
        method,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': '*/*',
        },
        signal: controller.signal,
        redirect: 'manual',
      });
      clearTimeout(timeoutId);
      return { response, error: null };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return { response: null, error: err };
    }
  }

  // Attempt 1: HEAD
  let { response, error } = await performFetch('HEAD');

  // Fallback to GET if 405 Method Not Allowed
  if (response && response.status === 405) {
    const getAttempt = await performFetch('GET');
    response = getAttempt.response;
    error = getAttempt.error;
  }

  // Retry 1x on network error or timeout
  if (!response || error) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    const retryAttempt = await performFetch('HEAD');
    response = retryAttempt.response;
    error = retryAttempt.error;

    if (response && response.status === 405) {
      const getRetry = await performFetch('GET');
      response = getRetry.response;
      error = getRetry.error;
    }
  }

  if (error || !response) {
    const errorMsg = error?.name === 'AbortError' ? 'ETIMEDOUT (5000ms)' : (error?.code || error?.message || 'Connection Error');
    return {
      statusCode: null,
      isActive: false,
      errorDetail: errorMsg,
    };
  }

  const status = response.status;

  if (status >= 200 && status < 300) {
    return {
      statusCode: status,
      isActive: true,
      errorDetail: null,
    };
  } else if (status >= 300 && status < 400) {
    const location = response.headers.get('location') || 'Redirect';
    return {
      statusCode: status,
      isActive: true,
      errorDetail: `Redirect -> ${location}`,
    };
  } else if (status === 401 || status === 403) {
    return {
      statusCode: status,
      isActive: false,
      errorDetail: `HTTP ${status} Auth Required`,
    };
  } else if (status === 404 || status === 410) {
    return {
      statusCode: status,
      isActive: false,
      errorDetail: `HTTP ${status} Not Found`,
    };
  } else if (status >= 500) {
    return {
      statusCode: status,
      isActive: false,
      errorDetail: `HTTP ${status} Server Error`,
    };
  } else {
    return {
      statusCode: status,
      isActive: false,
      errorDetail: `HTTP ${status}`,
    };
  }
}

/**
 * Checks ONLY Primary Endpoint for a single specific website and updates DB (skipping sold websites)
 */
export async function checkWebsiteEndpoints(websiteId: string): Promise<CheckResult[]> {
  return await dbRetry(async () => {
    const targetWebsites = await db.select().from(websites).where(eq(websites.id, websiteId));
    if (targetWebsites.length === 0) return [];

    const website = targetWebsites[0];
    // Skip sold websites
    if (website.status === 'sold') return [];

    // Fetch primary endpoints for this website
    let epList = await db
      .select()
      .from(endpoints)
      .where(and(eq(endpoints.website_id, websiteId), eq(endpoints.is_primary, true)));

    // Fallback: If no endpoint is explicitly flagged as primary, check the first available endpoint
    if (epList.length === 0) {
      const allEps = await db.select().from(endpoints).where(eq(endpoints.website_id, websiteId));
      if (allEps.length > 0) {
        epList = [allEps[0]];
      }
    }

    if (epList.length === 0) return [];

    const results: CheckResult[] = [];

    // Process primary endpoint
    for (const ep of epList) {
      const check = await checkSingleEndpointUrl(ep.url);
      const now = new Date();

      await db
        .update(endpoints)
        .set({
          status_code: check.statusCode,
          is_active: check.isActive,
          error_detail: check.errorDetail,
          last_checked_at: now,
        })
        .where(eq(endpoints.id, ep.id));

      results.push({
        endpoint_id: ep.id,
        url: ep.url,
        status_code: check.statusCode,
        is_active: check.isActive,
        error_detail: check.errorDetail,
      });
    }

    return results;
  });
}

/**
 * High-Scale Cron Engine: Priority Rotation & Concurrent Worker Batching
 * Checks ONLY Primary Endpoints of Active Websites (Skipping Sold), ordered by last_checked_at ASC NULLS FIRST.
 */
export async function checkAllActiveEndpoints(
  batchLimit = 100,
  concurrency = 10
): Promise<{ total_checked: number; active: number; inactive: number; batch_limit: number }> {
  return await dbRetry(async () => {
    // 1. Fetch active websites only (excluding sold)
    const activeWebsites = await db.select({ id: websites.id }).from(websites).where(eq(websites.status, 'active'));
    if (activeWebsites.length === 0) {
      return { total_checked: 0, active: 0, inactive: 0, batch_limit: batchLimit };
    }

    const activeWebsiteIds = activeWebsites.map((w) => w.id);

    // 2. Fetch PRIMARY endpoints for active websites, prioritized by oldest last_checked_at (NULLS FIRST)
    const targetPrimaryEndpoints = await db
      .select()
      .from(endpoints)
      .where(
        and(
          inArray(endpoints.website_id, activeWebsiteIds),
          eq(endpoints.is_primary, true)
        )
      )
      .orderBy(sql`${endpoints.last_checked_at} ASC NULLS FIRST`)
      .limit(batchLimit);

    if (targetPrimaryEndpoints.length === 0) {
      return { total_checked: 0, active: 0, inactive: 0, batch_limit: batchLimit };
    }

    let activeCount = 0;
    let inactiveCount = 0;

    // 3. Process in concurrent worker batches (e.g. 10 workers in parallel)
    for (let i = 0; i < targetPrimaryEndpoints.length; i += concurrency) {
      const chunk = targetPrimaryEndpoints.slice(i, i + concurrency);

      await Promise.all(
        chunk.map(async (ep) => {
          const check = await checkSingleEndpointUrl(ep.url);
          const now = new Date();

          await db
            .update(endpoints)
            .set({
              status_code: check.statusCode,
              is_active: check.isActive,
              error_detail: check.errorDetail,
              last_checked_at: now,
            })
            .where(eq(endpoints.id, ep.id));

          if (check.isActive) activeCount++;
          else inactiveCount++;
        })
      );
    }

    return {
      total_checked: targetPrimaryEndpoints.length,
      active: activeCount,
      inactive: inactiveCount,
      batch_limit: batchLimit,
    };
  });
}
