import { NextRequest, NextResponse } from 'next/server';
import { validateUsername } from '../../../../lib/identity/username';
import { isUsernameTaken } from '../../../../lib/identity/accountLookup';
import { RateLimiter } from '../../../../lib/security/rateLimiter';
import { getClientIp } from '../../../../lib/security/authRateLimiter';
import { logger } from '../../../../lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/username-available?username=…
 * Live check for the sign-up form. Usernames are public (profile URLs), so
 * saying whether one exists leaks nothing; the SEARCH-tier limit only stops
 * bulk scraping of the name space.
 */
export async function GET(request: NextRequest) {
  const rate = RateLimiter.checkRateLimit('SEARCH', `username-available:${getClientIp(request)}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many checks. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec ?? 60) } }
    );
  }

  const username = (request.nextUrl.searchParams.get('username') || '').trim();
  const invalid = validateUsername(username);
  if (invalid) {
    return NextResponse.json({ username, available: false, reason: 'invalid', error: invalid });
  }

  try {
    const taken = await isUsernameTaken(username);
    return NextResponse.json(
      taken
        ? { username, available: false, reason: 'taken', error: 'This username has been taken.' }
        : { username, available: true }
    );
  } catch (err) {
    logger.error('Username availability check failed', { error: err as Error, component: 'auth/username-available' });
    return NextResponse.json({ error: 'Could not check that username right now.' }, { status: 500 });
  }
}
