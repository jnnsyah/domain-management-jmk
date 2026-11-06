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
 * Extract domain from URL
 */
function extractDomainFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return null;
  }
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
    domain = extractDomainFromUrl(endpoints[0]);
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
 * 2. URL with different domain = new block (no separator needed)
 * 3. Double blank lines
 * 4. URL-only list (each URL = 1 domain)
 */
export function parseRawTextMulti(rawText: string): ParsedMultiWebsiteData {
  const lines = rawText.split(/\r?\n/);
  
  const domains: ParsedWebsiteData[] = [];
  let currentBlock: string[] = [];
  let currentDomain: string | null = null;
  let lastWasSeparator = false;

  const separatorRegex = /^(---+|===+|###+)\s*$/;
  const urlRegex = /^https?:\/\/[^\s]+/i;

  // Check if input is URL-only list (no key-value pairs, no endpoint: header)
  const isUrlOnlyList = lines.every(line => {
    const trimmed = line.trim();
    if (trimmed === '') return true;
    // Check if line starts with http:// or https://
    return /^https?:\/\//i.test(trimmed);
  });

  // If URL-only list, treat each URL as separate domain
  if (isUrlOnlyList) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const domain = extractDomainFromUrl(trimmed);
      if (domain) {
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
      }
    }
    return { domains, total: domains.length };
  }

  // Mixed format: auto-detect domain change from URLs
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for explicit separator line
    if (separatorRegex.test(trimmed)) {
      if (currentBlock.length > 0) {
        const blockText = currentBlock.join('\n');
        const parsed = parseRawText(blockText);
        if (parsed.domain) {
          domains.push(parsed);
        }
        currentBlock = [];
        currentDomain = null;
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

    // Check if URL line - detect domain change
    if (urlRegex.test(trimmed)) {
      const urlDomain = extractDomainFromUrl(trimmed);
      
      // If URL domain differs from current block domain, start new block
      if (urlDomain && currentDomain && urlDomain !== currentDomain && currentBlock.length > 0) {
        // Save current block
        const blockText = currentBlock.join('\n');
        const parsed = parseRawText(blockText);
        if (parsed.domain) {
          domains.push(parsed);
        }
        // Start new block with this URL
        currentBlock = [trimmed];
        currentDomain = urlDomain;
        lastWasSeparator = false;
        continue;
      }
      
      // Update current domain if not set
      if (!currentDomain && urlDomain) {
        currentDomain = urlDomain;
      }
    }

    // Check if login_url - also detect domain change
    const loginUrlMatch = trimmed.match(/^login_url\s*:\s*(https?:\/\/[^\s]+)$/i);
    if (loginUrlMatch) {
      const urlDomain = extractDomainFromUrl(loginUrlMatch[1]);
      // Set currentDomain from login_url if not set yet
      if (urlDomain && !currentDomain) {
        currentDomain = urlDomain;
      }
      // If login_url domain differs from current, start new block
      if (urlDomain && currentDomain && urlDomain !== currentDomain && currentBlock.length > 0) {
        const blockText = currentBlock.join('\n');
        const parsed = parseRawText(blockText);
        if (parsed.domain) {
          domains.push(parsed);
        }
        currentBlock = [];
        currentDomain = urlDomain;
      }
    }

    // Check if key-value with domain
    const domainMatch = trimmed.match(/^domain\s*:\s*(.+)$/i);
    if (domainMatch) {
      const newDomain = domainMatch[1].trim().replace(/^www\./i, '');
      // If domain differs from current, start new block
      if (currentDomain && newDomain !== currentDomain && currentBlock.length > 0) {
        const blockText = currentBlock.join('\n');
        const parsed = parseRawText(blockText);
        if (parsed.domain) {
          domains.push(parsed);
        }
        currentBlock = [];
      }
      currentDomain = newDomain;
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
