import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { hashPassword, signJwtToken, setSessionCookie, verifyPhonePass } from '../../../../../lib/auth';
import { validatePassword } from '../../../../../lib/identity/password';
import { SESSION_USER_SELECT, toSessionUser } from '../../../../../lib/identity/sessionUser';
import { checkIpRateLimit, rateLimitResponse, getClientIp } from '../../../../../lib/security/authRateLimiter';
import { logger } from '../../../../../lib/logger';

export const dynamic = 'force-dynamic';

const ROUTE = 'password-reset-phone';

/**
 * POST /api/auth/password-reset/phone { pass, password }
 *
 * "Forgot password" (2026-10-28): phone → SMS code (send-otp purpose
 * "reset") → POST /api/auth/phone/verify-code purpose "reset" → `pass` →
 * here with the new password. Also how older phone accounts create their
 * first password. Sets the password, records passwordChangedAt (so this pass
 * can't be used again) and signs the account in.
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

    const account = await prisma.user.findUnique({
      where: { phone: verified.phone },
      select: { id: true, username: true, passwordChangedAt: true, phoneVerifiedAt: true },
    });
    if (!account) return NextResponse.json({ error: 'No account uses this number.', code: 'PHONE_NOT_REGISTERED' }, { status: 404 });
    // Single use: a pass issued before the last password change is spent.
    if (account.passwordChangedAt && verified.issuedAt.getTime() <= account.passwordChangedAt.getTime()) {
      return NextResponse.json({ error: 'This verification was already used. Request a new code.', code: 'PASS_USED' }, { status: 400 });
    }

    const password = typeof body?.password === 'string' ? body.password : '';
    const passwordError = validatePassword(password, account.username);
    if (passwordError) return NextResponse.json({ error: passwordError, code: 'INVALID_PASSWORD' }, { status: 400 });

    const passwordHash = await hashPassword(password);
    // App clock, not the DB's NOW(): sessions are compared against this
    // (isSessionCurrent), and the new session below is signed after it.
    // Every session signed before this moment — other devices — is now dead.
    const now = new Date();
    await prisma.user.update({
      where: { id: account.id },
      data: { passwordHash, passwordChangedAt: now, lastLoginAt: now, lastSeenAt: now, phoneVerifiedAt: account.phoneVerifiedAt ?? now },
    });
    // Outstanding email reset links for this account are void now too.
    await prisma.passwordResetToken.updateMany({ where: { userId: account.id, usedAt: null }, data: { usedAt: new Date() } }).catch(() => undefined);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: account.id }, select: SESSION_USER_SELECT });
    const token = signJwtToken({ userId: user.id, username: user.username, email: user.email });
    const response = NextResponse.json({ user: toSessionUser(user), token, message: 'Password saved.' });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    logger.error('Phone password reset failed', { error: error as Error, component: 'auth/password-reset/phone' });
    return NextResponse.json({ error: 'Could not save the new password.' }, { status: 500 });
  }
}
