import dns from 'node:dns/promises';

/**
 * Resolves a domain name to IPv4 or IPv6 with fault tolerance (PRD Section 3.3)
 * Falls back to 'UNRESOLVED' if DNS lookup fails.
 */
export async function resolveDomainIp(domain: string): Promise<string> {
  const cleanedDomain = domain.trim().replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '');

  try {
    const ipv4Addresses = await dns.resolve4(cleanedDomain);
    if (ipv4Addresses && ipv4Addresses.length > 0) {
      return ipv4Addresses[0];
    }
  } catch {
    // IPv4 lookup failed, attempt IPv6 fallback
  }

  try {
    const ipv6Addresses = await dns.resolve6(cleanedDomain);
    if (ipv6Addresses && ipv6Addresses.length > 0) {
      return ipv6Addresses[0];
    }
  } catch {
    // IPv6 lookup failed
  }

  return 'UNRESOLVED';
}
