import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { signJwtToken, setSessionCookie, verifyPhonePass } from '../../../../../lib/auth';
import { validateUsername } from '../../../../../lib/identity/username';
import { SESSION_USER_SELECT, toSessionUser } from '../../../../../lib/identity/sessionUser';
import { checkIpRateLimit, rateLimitResponse, getClientIp } from '../../../../../lib/security/authRateLimiter';
import { logger } from '../../../../../lib/logger';

export const dynamic = 'force-dynamic';

const ROUTE = 'username-reset-phone';

/**
 * POST /api/auth/username-reset/phone { pass, username }
 *
 * "Forgot username" (2026-11-03, owner): username or phone → SMS code →
 * POST /api/auth/phone/verify-code purpose "reset" → `pass` → choose
 * "Reset username" → here with the new username (typed twice in the form).
 * Same rules as sign-up (validateUsername, free case-insensitively — a
 * case-only change of your own name is allowed). Signs the account in.
 * The password and every session are untouched.
 */
export async function POST(request: NextRequest) {
  try {
    const ipLimit = await checkIpRateLimit(ROUTE, getClientIp(request));
    if (!ipLimit.allowed) {
      return rateLimitResponse('Too many attempts from this network. Please try again later.', ipLimit.retryAfterSec!);
    }
    const body = await request.json().catch(() => ({}));
    const verified = verifyPhonePass(body?.pass, 'reset');
    if (!verified) {
      return NextResponse.json({ error: 'Your phone verification expired. Request a new code.', code: 'PASS_INVALID' }, { status: 400 });
    }

    const account = await prisma.user.findUnique({ where: { phone: verified.phone }, select: { id: true, username: true } });
    if (!account) return NextResponse.json({ error: 'No account uses this number.', code: 'PHONE_NOT_REGISTERED' }, { status: 404 });

    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const usernameError = validateUsername(username);
    if (usernameError) return NextResponse.json({ error: usernameError, code: 'INVALID_USERNAME' }, { status: 400 });
    if (username === account.username) {
      return NextResponse.json({ error: 'That is already your username.', code: 'SAME_USERNAME' }, { status: 400 });
    }

    const taken = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' }, NOT: { id: account.id } },
      select: { id: true },
    });
    if (taken) return NextResponse.json({ error: 'This username has been taken.', code: 'USERNAME_TAKEN' }, { status: 409 });

    try {
      await prisma.user.update({ where: { id: account.id }, data: { username, lastLoginAt: new Date(), lastSeenAt: new Date() } });
    } catch (err: any) {
      // Two people grabbing the same name at once: the unique index decides.
      if (err?.code === 'P2002') return NextResponse.json({ error: 'This username has been taken.', code: 'USERNAME_TAKEN' }, { status: 409 });
      throw err;
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: account.id }, select: SESSION_USER_SELECT });
    const token = signJwtToken({ userId: user.id, username: user.username, email: user.email });
    const response = NextResponse.json({ user: toSessionUser(user), token, message: 'Username changed.' });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    logger.error('Phone username reset failed', { error: error as Error, component: 'auth/username-reset/phone' });
    return NextResponse.json({ error: 'Could not change the username.' }, { status: 500 });
  }
}
