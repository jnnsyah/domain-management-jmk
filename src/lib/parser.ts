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

export interface ParsedMultiWebsiteData {
  domains: ParsedWebsiteData[];
  total: number;
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

/**
 * Parses raw text containing multiple domains
 * Auto-detect formats:
 * 1. Separator: "---" or "===" or "###"
 * 2. Double blank lines
 * 3. URL-only list (each URL = 1 domain) - NO separator needed
 * 4. Mixed: credentials + endpoints per domain block
 */
export function parseRawTextMulti(rawText: string): ParsedMultiWebsiteData {
  const lines = rawText.split(/\r?\n/);
  
  const domains: ParsedWebsiteData[] = [];
  let currentBlock: string[] = [];
  let lastWasSeparator = false;
  let hasKeyValues = false;

  const separatorRegex = /^(---+|===+|###+)\s*$/;
  const kvRegex = /^(domain|username|login_user|password|login_password|login_url|email|gsocket_user|gsocket_root)\s*:/i;
  const urlRegex = /^https?:\/\/[^\s]+/i;

  // Check if input is URL-only list (no key-value pairs)
  const isUrlOnlyList = lines.every(line => {
    const trimmed = line.trim();
    return trimmed === '' || urlRegex.test(trimmed);
  });

  // If URL-only list, treat each URL as separate domain
  if (isUrlOnlyList) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      try {
        const url = new URL(trimmed);
        const domain = url.hostname.replace(/^www\./i, '');
        domains.push({
          domain,
          login_url: null,
          email: null,
          login_user: null,
          login_password: null,
          gsocket_user: null,
          gsocket_root: null,
          endpoints: [{ url: trimmed, is_primary: true }],
        });
      } catch {
        // Skip invalid URLs
      }
    }
    return { domains, total: domains.length };
  }

  // Standard parsing for mixed format
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for separator line
    if (separatorRegex.test(trimmed)) {
      if (currentBlock.length > 0) {
        const blockText = currentBlock.join('\n');
        const parsed = parseRawText(blockText);
        if (parsed.domain) {
          domains.push(parsed);
        }
        currentBlock = [];
        hasKeyValues = false;
      }
      lastWasSeparator = true;
      continue;
    }

    // Check for blank line
    if (trimmed === '') {
      if (lastWasSeparator) {
        continue;
      }
      if (currentBlock.length > 0) {
        lastWasSeparator = true;
        continue;
      }
      continue;
    }

    // Check if line has key-value
    if (kvRegex.test(trimmed)) {
      hasKeyValues = true;
    }

    // Check if URL line and we have previous block with key-values
    if (urlRegex.test(trimmed) && hasKeyValues && currentBlock.length > 0) {
      // Check if next line is also URL (means new domain starting)
      // For now, just add to current block
    }

    currentBlock.push(trimmed);
    lastWasSeparator = false;
  }

  // Parse remaining block
  if (currentBlock.length > 0) {
    const blockText = currentBlock.join('\n');
    const parsed = parseRawText(blockText);
    if (parsed.domain) {
      domains.push(parsed);
    }
  }

  return {
    domains,
    total: domains.length,
  };
}
