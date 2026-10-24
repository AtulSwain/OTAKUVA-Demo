import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { generateRawToken, hashToken, PASSWORD_RESET_TOKEN_TTL_MS } from '../../../../../lib/security/tokens';
import { sendEmail } from '../../../../../lib/email/emailSender';
import {
  checkIpRateLimit,
  checkAccountRateLimit,
  recordAccountFailure,
  rateLimitResponse,
  getClientIp,
} from '../../../../../lib/security/authRateLimiter';
import { logger } from '../../../../../lib/logger';

export const dynamic = 'force-dynamic';

const ROUTE = 'password-reset-request';

// Generic response for every outcome that isn't a validation error or rate
// limit — same wording whether the email exists or not, so this endpoint
// can't be used to enumerate registered accounts.
const GENERIC_MESSAGE = 'If an account exists for that email, a password reset link has been sent.';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const ipLimit = await checkIpRateLimit(ROUTE, ip);
    if (!ipLimit.allowed) {
      return rateLimitResponse('Too many password reset requests from this network. Please try again later.', ipLimit.retryAfterSec!);
    }

    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    // Every request against this email counts toward its limit, whether or
    // not the account exists — otherwise an attacker could brute-force
    // which emails are registered by watching which ones never rate-limit.
    const accountLimit = await checkAccountRateLimit(ROUTE, email);
    if (!accountLimit.allowed) {
      // Deliberately still generic — a distinct "this account is
      // rate-limited" message would itself leak that the email exists.
      return rateLimitResponse(GENERIC_MESSAGE, accountLimit.retryAfterSec!);
    }
    await recordAccountFailure(ROUTE, email);

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, username: true, email: true } });

    // user.email is always set here (found by it); the check narrows the type.
    if (user?.email) {
      const rawToken = generateRawToken();
      const tokenHash = hashToken(rawToken);

      await prisma.$transaction([
        // Invalidate any still-outstanding reset tokens for this user first
        // — only the newest request's link should work, so an old leaked
        // email doesn't stay valid alongside a fresh one.
        prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
        prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
            requestIp: ip,
          },
        }),
      ]);

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const resetLink = `${appUrl}/reset-password?token=${rawToken}`;

      try {
        await sendEmail({
          to: user.email,
          subject: 'Reset your OTAKUVA password',
          text: `Hi ${user.username},\n\nSomeone requested a password reset for your OTAKUVA account. This link expires in 1 hour and can only be used once:\n\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.`,
        });
      } catch (err) {
        // Never let a delivery failure surface to the caller (would leak
        // account existence) or block the response — log it instead.
        logger.error('Failed to send password reset email', { error: err as Error, component: 'auth/password-reset/request' });
      }
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    logger.error('Password reset request error', { error: error as Error, component: 'auth/password-reset/request' });
    return NextResponse.json({ error: 'Failed to process password reset request.' }, { status: 500 });
  }
}
