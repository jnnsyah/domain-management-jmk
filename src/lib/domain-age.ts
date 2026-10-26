interface DomainAgeResponse {
  ok: boolean;
  data?: {
    domain: string;
    created: string;
    expires: string;
    updated: string;
    ageDays: number;
    ageYears: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Fetch domain age from Domainee API (free, no key required)
 * Rate limit: 30 req/min, 500 req/day per IP
 */
export async function fetchDomainAge(domain: string): Promise<DomainAgeResponse> {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  
  try {
    const response = await fetch(
      `https://api.domainee.dev/v1/tools/domain-age-checker?domain=${encodeURIComponent(cleanDomain)}`,
      {
        signal: AbortSignal.timeout(10000), // 10s timeout
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return {
          ok: false,
          error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded. Try again later.' },
        };
      }
      
      return {
        ok: false,
        error: { code: 'API_ERROR', message: `HTTP ${response.status}` },
      };
    }

    const json = await response.json();
    
    if (!json.ok || !json.data) {
      return {
        ok: false,
        error: { code: 'NO_DATA', message: json.error?.message || 'No domain age data available.' },
      };
    }

    return {
      ok: true,
      data: {
        domain: json.data.domain,
        created: json.data.created,
        expires: json.data.expires,
        updated: json.data.updated,
        ageDays: json.data.ageDays,
        ageYears: json.data.ageYears,
      },
    };
  } catch (error) {
    console.error('[DOMAIN_AGE] Fetch error:', error);
    return {
      ok: false,
      error: { code: 'FETCH_ERROR', message: error instanceof Error ? error.message : 'Network error' },
    };
  }
}

/**
 * Format domain age for display
 */
export function formatDomainAge(ageInDays: number): string {
  const years = Math.floor(ageInDays / 365);
  const months = Math.floor((ageInDays % 365) / 30);
  
  if (years === 0) {
    return months === 0 ? `${ageInDays} days` : `${months} month${months > 1 ? 's' : ''}`;
  }
  
  if (months === 0) {
    return `${years} year${years > 1 ? 's' : ''}`;
  }
  
  return `${years} year${years > 1 ? 's' : ''} ${months} month${months > 1 ? 's' : ''}`;
}

/**
 * Get domain age category
 */
export function getDomainAgeCategory(ageInDays: number): 'new' | 'young' | 'established' | 'mature' | 'veteran' {
  if (ageInDays < 30) return 'new';
  if (ageInDays < 365) return 'young';
  if (ageInDays < 1825) return 'established'; // 5 years
  if (ageInDays < 3650) return 'mature'; // 10 years
  return 'veteran';
}

/**
 * Check if domain is newly registered (fraud/spam signal)
 */
export function isNewlyRegistered(ageInDays: number): boolean {
  return ageInDays < 30;
}
