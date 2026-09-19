import { lookup } from "dns/promises";

/**
 * SSRF Security Safeguards
 * ------------------------
 * 1. Protocol validation: Allow http: and https: only.
 * 2. Credential check: Reject URLs with embedded credentials (user:pass@host).
 * 3. Domain & IP validation: Block localhost, loopback, private RFC1918 subnets, link-local, cloud metadata.
 * 4. DNS resolution: Resolve DNS records server-side and verify all IP destinations before sending outbound requests.
 */

export function isPrivateIPv4(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);
  if (!match) return false;

  const octets = match.slice(1).map(Number);
  if (octets.some((o) => o > 255)) return true; // Invalid octet treated as blocked

  const [a, b] = octets;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 10.0.0.0/8 (Private RFC1918)
  if (a === 10) return true;

  // 172.16.0.0/12 (Private RFC1918: 172.16.0.0 – 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private RFC1918)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (Link-Local / Cloud Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 0.0.0.0/8
  if (a === 0) return true;

  // 100.64.0.0/10 (CGNAT: 100.64.0.0 – 100.127.255.255)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 224.0.0.0/4 (Multicast & Reserved)
  if (a >= 224) return true;

  return false;
}

export function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fc")
  ) {
    return true;
  }
  return false;
}

export async function validateReplayUrl(
  targetUrl: string
): Promise<{ valid: boolean; reason?: string; url?: URL; resolvedIp?: string }> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return { valid: false, reason: "Invalid destination URL format." };
  }

  // 1. Enforce Scheme Rules
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return {
      valid: false,
      reason: "This destination cannot be used for security reasons. Only HTTP and HTTPS protocols are allowed.",
    };
  }

  // 2. Reject URL-embedded Credentials
  if (parsedUrl.username || parsedUrl.password) {
    return {
      valid: false,
      reason: "This destination cannot be used for security reasons. Embedded URL credentials are not allowed.",
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // 3. Block obvious local domains
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".lan")
  ) {
    return {
      valid: false,
      reason: "This destination cannot be used for security reasons.",
    };
  }

  // 4. Check if hostname is an IP literal
  if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
    return {
      valid: false,
      reason: "This destination cannot be used for security reasons.",
    };
  }

  // 5. DNS Resolution & IP Range Validation
  try {
    const addresses = await lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, reason: "Unable to resolve destination host DNS." };
    }

    for (const addr of addresses) {
      if (addr.family === 4 && isPrivateIPv4(addr.address)) {
        return {
          valid: false,
          reason: "This destination cannot be used for security reasons.",
        };
      }
      if (addr.family === 6 && isPrivateIPv6(addr.address)) {
        return {
          valid: false,
          reason: "This destination cannot be used for security reasons.",
        };
      }
    }

    const firstAddress = addresses[0].address;
    return { valid: true, url: parsedUrl, resolvedIp: firstAddress };
  } catch {
    return { valid: false, reason: `DNS lookup failed for destination hostname '${hostname}'.` };
  }
}
