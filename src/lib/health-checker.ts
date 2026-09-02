import { db } from '@/db';
import { websites, endpoints } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

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
 * Performs HTTP HEAD check with GET fallback and 1x retry on timeout (PRD Section 5.2 & 5.3)
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

  // Status code classification matching PRD Section 5.3
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
 * Checks all endpoints for a specific website and updates DB
 */
export async function checkWebsiteEndpoints(websiteId: string): Promise<CheckResult[]> {
  const targetWebsites = await db.select().from(websites).where(eq(websites.id, websiteId));
  if (targetWebsites.length === 0) return [];

  const website = targetWebsites[0];
  // PRD 5.1: Sold domains are skipped
  if (website.status === 'sold') return [];

  const epList = await db.select().from(endpoints).where(eq(endpoints.website_id, websiteId));
  const results: CheckResult[] = [];

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

    // Throttling 300ms between requests (PRD 5.2)
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return results;
}

/**
 * Scans all active website endpoints in background (skipping sold websites)
 */
export async function checkAllActiveEndpoints(): Promise<{ total_checked: number; active: number; inactive: number }> {
  // Fetch active websites only
  const activeWebsites = await db.select().from(websites).where(eq(websites.status, 'active'));
  if (activeWebsites.length === 0) {
    return { total_checked: 0, active: 0, inactive: 0 };
  }

  const activeWebsiteIds = activeWebsites.map((w) => w.id);
  const activeEndpoints = await db.select().from(endpoints).where(inArray(endpoints.website_id, activeWebsiteIds));

  let activeCount = 0;
  let inactiveCount = 0;

  for (const ep of activeEndpoints) {
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

    // Throttling 300ms between checks
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return {
    total_checked: activeEndpoints.length,
    active: activeCount,
    inactive: inactiveCount,
  };
}
