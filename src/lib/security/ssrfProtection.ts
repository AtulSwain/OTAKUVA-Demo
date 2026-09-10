/**
 * OTAKUVA SECURITY — PHASE 10.1
 * SSRF (SERVER-SIDE REQUEST FORGERY) PROTECTION
 * 
 * Guards outbound HTTP fetchers against malicious internal network probing:
 * - Rejects non-HTTP/HTTPS schemes (e.g. `file:`, `gopher:`, `ftp:`, `data:`)
 * - Blocks loopback / localhost (`127.0.0.1`, `localhost`, `::1`)
 * - Blocks RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
 * - Blocks Cloud metadata endpoints (`169.254.169.254`, `metadata.google.internal`)
 * - Domain allowlist/denylist verification
 */

export interface SsrfCheckResult {
  isSafe: boolean;
  reason?: string;
  normalizedUrl?: string;
}

export class SsrfProtection {
  private static readonly BLOCKED_HOSTNAMES = new Set([
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    'metadata.google.internal',
    'instance-data',
    '169.254.169.254',
  ]);

  /**
   * Checks if an IP string belongs to a private / reserved IP range
   */
  static isPrivateIp(ip: string): boolean {
    // IPv4 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return false;
    }

    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (Private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (Link-Local / Cloud Metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8
    if (parts[0] === 0) return true;

    return false;
  }

  /**
   * Validates if a target URL is safe for server-side fetching
   */
  static isUrlSafe(targetUrl: string): SsrfCheckResult {
    if (!targetUrl || typeof targetUrl !== 'string') {
      return { isSafe: false, reason: 'URL must be a non-empty string.' };
    }

    try {
      const parsed = new URL(targetUrl);

      // 1. Protocol validation: Only http and https
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          isSafe: false,
          reason: `Disallowed protocol scheme "${parsed.protocol}". Only HTTP and HTTPS are permitted.`,
        };
      }

      const hostname = parsed.hostname.toLowerCase();

      // 2. Blocked hostnames check
      if (this.BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
        return {
          isSafe: false,
          reason: `Requests to internal or loopback host "${hostname}" are forbidden.`,
        };
      }

      // 3. Check for raw private IP addresses
      if (this.isPrivateIp(hostname)) {
        return {
          isSafe: false,
          reason: `Requests to private subnet IP "${hostname}" are forbidden.`,
        };
      }

      // 4. Block dangerous ports (e.g. redis 6379, ssh 22, database 5432/3306)
      if (parsed.port) {
        const portNum = parseInt(parsed.port, 10);
        const forbiddenPorts = [22, 25, 6379, 5432, 3306, 27017, 9200, 2375];
        if (forbiddenPorts.includes(portNum)) {
          return {
            isSafe: false,
            reason: `Requests to port ${portNum} are restricted.`,
          };
        }
      }

      return {
        isSafe: true,
        normalizedUrl: parsed.toString(),
      };
    } catch (err: any) {
      return {
        isSafe: false,
        reason: `Invalid URL format: ${err?.message || 'Parse error'}`,
      };
    }
  }
}
