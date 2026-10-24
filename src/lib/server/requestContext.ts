import { headers, cookies } from 'next/headers';

/**
 * The origin (scheme + host) of the current request, for a Server Component
 * that needs to call this app's own Route Handlers internally. Prefers the
 * actual request headers (correct behind any proxy/port/host) over the
 * NEXT_PUBLIC_APP_URL env var, which is only a fallback for contexts with no
 * request (e.g. background jobs).
 */
export function getRequestOrigin(): string {
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/** The current request's cookies, serialized for forwarding on an internal
 *  server-to-server fetch (so an authenticated visitor's own Route Handler
 *  calls stay authenticated as them). */
export function getForwardedCookieHeader(): string {
  return cookies().toString();
}
