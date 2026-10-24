import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { hashPassword } from '../../../../../lib/auth';
import { hashToken } from '../../../../../lib/security/tokens';
import { checkIpRateLimit, rateLimitResponse, getClientIp } from '../../../../../lib/security/authRateLimiter';
import { logger } from '../../../../../lib/logger';

export const dynamic = 'force-dynamic';

const ROUTE = 'password-reset-confirm';

// Same wording for "no such token", "already used", and "expired" — which
// specific reason it failed for isn't useful to the caller and would only
// help someone probing for valid-but-expired tokens.
const INVALID_TOKEN_MESSAGE = 'This password reset link is invalid or has expired. Please request a new one.';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const ipLimit = await checkIpRateLimit(ROUTE, ip);
    if (!ipLimit.allowed) {
      return rateLimitResponse('Too many attempts from this network. Please try again later.', ipLimit.retryAfterSec!);
    }

    const body = await request.json();
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

    if (!token) {
      return NextResponse.json({ error: 'Reset token is required.' }, { status: 400 });
    }
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    const now = new Date();
    if (!resetToken || resetToken.usedAt !== null || resetToken.expiresAt < now) {
      return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      // Mark this one used...
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: now } }),
      // ...and invalidate any other outstanding tokens for the account, so
      // a second leaked/older link can't also be used after this reset.
      prisma.passwordResetToken.deleteMany({
        where: { userId: resetToken.userId, usedAt: null, id: { not: resetToken.id } },
      }),
    ]);

    // Deliberately no auto-login here — the caller goes back to the normal
    // sign-in flow with their new password, keeping this route's only job
    // "change the password," not "also issue a session."
    return NextResponse.json({ message: 'Your password has been reset. Please sign in with your new password.' });
  } catch (error) {
    logger.error('Password reset confirm error', { error: error as Error, component: 'auth/password-reset/confirm' });
    return NextResponse.json({ error: 'Failed to reset password.' }, { status: 500 });
  }
}
