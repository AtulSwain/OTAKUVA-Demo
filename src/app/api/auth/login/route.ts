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
 *   { phone, country?, code }  — the sign-in method. Code requested first
 *                                via POST /api/auth/phone/send-otp (purpose "login").
 *   { identifier, password }   — legacy email/password accounts only, and
 *                                only until they link a phone; after that
 *                                the account signs in by phone like any other.
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

  const user = await prisma.user.findUnique({ where: { phone }, select: SESSION_USER_SELECT });
  if (!user) {
    return NextResponse.json({ error: 'No account uses this number yet. Create an account instead.' }, { status: 401 });
  }
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
    return NextResponse.json({ error: 'Enter your phone number to sign in.' }, { status: 400 });
  }

  const accountLimit = await checkAccountRateLimit(ROUTE, identifier);
  if (!accountLimit.allowed) {
    return rateLimitResponse('Too many failed sign-in attempts for this account. Please try again in 15 minutes.', accountLimit.retryAfterSec!);
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier.toLowerCase() }, { username: identifier }] },
    select: { ...SESSION_USER_SELECT, passwordHash: true },
  });
  if (!user || !user.passwordHash || !(await comparePassword(password, user.passwordHash))) {
    await recordAccountFailure(ROUTE, identifier);
    return NextResponse.json({ error: 'Invalid username/email or password.' }, { status: 401 });
  }
  await resetAccountRateLimit(ROUTE, identifier);

  // Only checked after the password matched, so it reveals nothing to a guesser.
  if (user.phoneVerifiedAt) {
    return NextResponse.json(
      { error: 'This account now signs in with its phone number. Use "Sign in with phone" instead.', code: 'USE_PHONE_SIGN_IN' },
      { status: 400 }
    );
  }
  const { passwordHash: _omit, ...safe } = user;
  return safe;
}
