export interface ParsedWebsiteData {
  domain: string | null;
  login_url: string | null;
  email: string | null;
  login_user: string | null;
  login_password: string | null;
  gsocket_user: string | null;
  gsocket_root: string | null;
  endpoints: { url: string; is_primary: boolean }[];
}

/**
 * Parses raw text input line-by-line using key-value and endpoint extraction rules (PRD Section 3.1)
 */
export function parseRawText(rawText: string): ParsedWebsiteData {
  const lines = rawText.split(/\r?\n/);
  
  let domain: string | null = null;
  let login_url: string | null = null;
  let email: string | null = null;
  let login_user: string | null = null;
  let login_password: string | null = null;
  let gsocket_user: string | null = null;
  let gsocket_root: string | null = null;
  
  const endpoints: string[] = [];
  let isScanningEndpoints = false;

  const kvRegex = /^(domain|username|login_user|password|login_password|login_url|email|gsocket_user|gsocket_root)\s*:\s*(.+)$/i;
  const endpointHeaderRegex = /^endpoints?\s*:/i;
  const urlRegex = /^(https?:\/\/[^\s]+)/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (endpointHeaderRegex.test(line)) {
      isScanningEndpoints = true;
      // Check if there is an inline URL on the same line after 'endpoint:'
      const inlineUrlMatch = line.match(/^endpoints?\s*:\s*(https?:\/\/[^\s]+)/i);
      if (inlineUrlMatch && inlineUrlMatch[1]) {
        endpoints.push(inlineUrlMatch[1]);
      }
      continue;
    }

    const kvMatch = line.match(kvRegex);
    if (kvMatch && !isScanningEndpoints) {
      const key = kvMatch[1].toLowerCase();
      const val = kvMatch[2].trim();

      if (key === 'domain') domain = val.replace(/^www\./i, '');
      else if (key === 'login_url') login_url = val;
      else if (key === 'username' || key === 'login_user') login_user = val;
      else if (key === 'password' || key === 'login_password') login_password = val;
      else if (key === 'email') email = val;
      else if (key === 'gsocket_user') gsocket_user = val;
      else if (key === 'gsocket_root') gsocket_root = val;
      continue;
    }

    const urlMatch = line.match(urlRegex);
    if (urlMatch) {
      endpoints.push(urlMatch[1]);
    }
  }

  // Extract domain from first endpoint if domain wasn't explicitly given
  if (!domain && endpoints.length > 0) {
    try {
      const firstUrl = new URL(endpoints[0]);
      domain = firstUrl.hostname.replace(/^www\./i, '');
    } catch {
      domain = null;
    }
  }

  // Format endpoints (first one is primary)
  const structuredEndpoints = endpoints.map((url, index) => ({
    url,
    is_primary: index === 0,
  }));

  return {
    domain,
    login_url,
    email,
    login_user,
    login_password,
    gsocket_user,
    gsocket_root,
    endpoints: structuredEndpoints,
  };
}
