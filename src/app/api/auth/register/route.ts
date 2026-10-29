import { alertAdmins } from '../../../../lib/notifications/adminAlerts';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { signJwtToken, setSessionCookie, hashPassword, verifyPhonePass } from '../../../../lib/auth';
import { validatePassword } from '../../../../lib/identity/password';
import { normalizePhone } from '../../../../lib/identity/phoneNumber';
import { validateUsername } from '../../../../lib/identity/username';
import { findUserIdByPhone, isUsernameTaken } from '../../../../lib/identity/accountLookup';
import { verifyOtpOrRespond } from '../../../../lib/identity/otpRoute';
import { SESSION_USER_SELECT, toSessionUser } from '../../../../lib/identity/sessionUser';
import { checkIpRateLimit, rateLimitResponse, getClientIp } from '../../../../lib/security/authRateLimiter';
import { logger } from '../../../../lib/logger';

export const dynamic = 'force-dynamic';

const ROUTE = 'register';

/**
 * POST /api/auth/register { username, password, pass }      ← the sign-up form
 *                         { username, password, phone, country?, code }  (one step)
 *
 * Sign-up (2026-10-28): username + phone → SMS code → password. The code is
 * checked first by POST /api/auth/phone/verify-code, which returns `pass`
 * (proof the phone was verified, 10 min); the account is created with that
 * phone and a hashed password, and signed in. A password is always required.
 * One account per number (User.phone is unique).
 */
export async function POST(request: NextRequest) {
  try {
    const ipLimit = await checkIpRateLimit(ROUTE, getClientIp(request));
    if (!ipLimit.allowed) {
      return rateLimitResponse('Too many registration attempts from this network. Please try again later.', ipLimit.retryAfterSec!);
    }

    const body = await request.json().catch(() => ({}));
    const username = String(body?.username ?? '').trim();
    const usernameError = validateUsername(username);
    if (usernameError) {
      return NextResponse.json({ error: usernameError, code: 'INVALID_USERNAME' }, { status: 400 });
    }
    const password = typeof body?.password === 'string' ? body.password : '';
    const passwordError = validatePassword(password, username);
    if (passwordError) {
      return NextResponse.json({ error: passwordError, code: 'INVALID_PASSWORD' }, { status: 400 });
    }

    // Phone: from a verified pass (the form), or a number + code (one step).
    const verified = body?.pass !== undefined ? verifyPhonePass(body.pass, 'register') : null;
    if (body?.pass !== undefined && !verified) {
      return NextResponse.json({ error: 'Your phone verification expired. Request a new code.', code: 'PASS_INVALID' }, { status: 400 });
    }
    const phone = verified ? verified.phone : normalizePhone(String(body?.phone ?? ''), String(body?.country ?? 'IN'));
    if (!phone) {
      return NextResponse.json({ error: 'Enter a valid mobile number.', code: 'INVALID_PHONE' }, { status: 400 });
    }

    // Checked before the OTP: a Twilio check consumes the code, so a
    // request that would fail anyway must not burn it.
    if (await isUsernameTaken(username)) {
      return NextResponse.json({ error: 'This username has been taken.', code: 'USERNAME_TAKEN' }, { status: 409 });
    }
    if (await findUserIdByPhone(phone)) {
      return NextResponse.json(
        { error: 'This number already has an OTAKUVA account. Sign in instead.', code: 'PHONE_IN_USE' },
        { status: 409 }
      );
    }

    if (!verified) {
      const otpFailure = await verifyOtpOrRespond(phone, body?.code);
      if (otpFailure) return otpFailure;
    }

    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = await prisma.user.create({
        data: {
          username,
          phone,
          phoneVerifiedAt: new Date(),
          passwordHash,
          // No generated avatar: members without a photo get a monogram (UserAvatar / getAvatarUrl).
        },
        select: SESSION_USER_SELECT,
      });
    } catch (err) {
      // Lost a race with another sign-up between the checks above and here.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = String((err.meta as { target?: unknown } | undefined)?.target ?? '');
        return target.includes('phone')
          ? NextResponse.json({ error: 'This number already has an OTAKUVA account. Sign in instead.', code: 'PHONE_IN_USE' }, { status: 409 })
          : NextResponse.json({ error: 'This username has been taken.', code: 'USERNAME_TAKEN' }, { status: 409 });
      }
      throw err;
    }

    // Raw SQL: these columns are newer than the running server's Prisma client may be.
    await prisma.$executeRaw`UPDATE "User" SET "lastLoginAt" = NOW(), "lastSeenAt" = NOW(), "passwordChangedAt" = NOW() WHERE id = ${user.id}`;

    await alertAdmins('ADMIN_NEW_MEMBER', 'New member', `@${user.username} created an account.`, '/control/users');

    const token = signJwtToken({ userId: user.id, username: user.username, email: null });
    const response = NextResponse.json({ user: toSessionUser(user), token, message: 'Welcome to OTAKUVA!' });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    logger.error('Registration failed', { error: error as Error, component: 'auth/register' });
    return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 });
  }
}
