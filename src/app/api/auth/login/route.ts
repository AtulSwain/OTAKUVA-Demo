import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { comparePassword, signJwtToken, setSessionCookie, syncSuperAdminBootstrap } from '../../../../lib/auth';
import { normalizePhone } from '../../../../lib/identity/phoneNumber';
import { verifyOtpOrRespond } from '../../../../lib/identity/otpRoute';
import { SESSION_USER_SELECT, toSessionUser } from '../../../../lib/identity/sessionUser';
import {
  checkIpRateLimit,
  checkAccountRateLimit,
  recordAccountFailure,
  resetAccountRateLimit,
  rateLimitResponse,
  getClientIp,
} from '../../../../lib/security/authRateLimiter';
import { logger } from '../../../../lib/logger';

export const dynamic = 'force-dynamic';

const ROUTE = 'login';

/**
 * POST /api/auth/login
 *
 *   { identifier, password }   — THE sign-in (2026-10-28): username (or a
 *                                legacy account's email) + password, for
 *                                every account.
 *   { phone, country?, code }  — only for older phone accounts that have
 *                                no password yet; refused once a password
 *                                is set, so the code can't bypass it. Those
 *                                accounts are pointed to "Forgot password".
 */
export async function POST(request: NextRequest) {
  try {
    const ipLimit = await checkIpRateLimit(ROUTE, getClientIp(request));
    if (!ipLimit.allowed) {
      return rateLimitResponse('Too many sign-in attempts from this network. Please try again later.', ipLimit.retryAfterSec!);
    }

    const body = await request.json().catch(() => ({}));
    const user = body?.phone !== undefined ? await phoneSignIn(body) : await legacyPasswordSignIn(body);
    if (user instanceof NextResponse) return user;

    const effectiveRole = await syncSuperAdminBootstrap(user.id, user.email, user.role);
    await prisma.$executeRaw`UPDATE "User" SET "lastLoginAt" = NOW(), "lastSeenAt" = NOW() WHERE id = ${user.id}`;
    const token = signJwtToken({ userId: user.id, username: user.username, email: user.email });
    const response = NextResponse.json({ user: toSessionUser(user, effectiveRole), token, message: 'Signed in successfully.' });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    logger.error('Sign-in failed', { error: error as Error, component: 'auth/login' });
    return NextResponse.json({ error: 'Failed to sign in.' }, { status: 500 });
  }
}

async function phoneSignIn(body: any) {
  const phone = normalizePhone(String(body.phone ?? ''), String(body.country ?? 'IN'));
  if (!phone) {
    return NextResponse.json({ error: 'Enter a valid mobile number.', code: 'INVALID_PHONE' }, { status: 400 });
  }
  const otpFailure = await verifyOtpOrRespond(phone, body.code);
  if (otpFailure) return otpFailure;

  const found = await prisma.user.findUnique({ where: { phone }, select: { ...SESSION_USER_SELECT, passwordHash: true } });
  if (!found) {
    return NextResponse.json({ error: 'No account uses this number yet. Create an account instead.' }, { status: 401 });
  }
  if (found.passwordHash) {
    return NextResponse.json({ error: 'Sign in with your username and password.', code: 'USE_PASSWORD' }, { status: 400 });
  }
  const { passwordHash: _ph, ...user } = found;
  if (!user.phoneVerifiedAt) {
    // Possession of the number was just proven by the OTP.
    return prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() }, select: SESSION_USER_SELECT });
  }
  return user;
}

async function legacyPasswordSignIn(body: any) {
  const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : '';
  const password = body?.password;
  if (!identifier || !password) {
    return NextResponse.json({ error: 'Enter your username and password.' }, { status: 400 });
  }

  const accountLimit = await checkAccountRateLimit(ROUTE, identifier);
  if (!accountLimit.allowed) {
    return rateLimitResponse('Too many failed sign-in attempts for this account. Please try again in 15 minutes.', accountLimit.retryAfterSec!);
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: identifier, mode: 'insensitive' } },
        { email: identifier.toLowerCase() },
      ],
    },
    select: { ...SESSION_USER_SELECT, passwordHash: true },
  });
  if (user && !user.passwordHash) {
    // A phone account from before passwords: it has to create one first.
    return NextResponse.json(
      { error: "This account doesn't have a password yet. Use \"Forgot password\" to create one with your phone number.", code: 'NO_PASSWORD' },
      { status: 400 }
    );
  }
  if (!user || !user.passwordHash || !(await comparePassword(password, user.passwordHash))) {
    await recordAccountFailure(ROUTE, identifier);
    return NextResponse.json({ error: 'Wrong username or password.' }, { status: 401 });
  }
  await resetAccountRateLimit(ROUTE, identifier);
  const { passwordHash: _omit, ...safe } = user;
  return safe;
}
