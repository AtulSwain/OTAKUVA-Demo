import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { normalizePhone } from '../../../../../lib/identity/phoneNumber';
import { validateUsername } from '../../../../../lib/identity/username';
import { findUserIdByPhone, isUsernameTaken } from '../../../../../lib/identity/accountLookup';
import { isDevOtpSender, peekDevOtp, sendOtp, type OtpSendFailureReason } from '../../../../../lib/identity/otpService';
import { isMockOtpMode } from '../../../../../lib/identity/identityConfig';
import {
  checkIpRateLimit,
  checkAccountRateLimit,
  recordAccountFailure,
  rateLimitResponse,
  getClientIp,
} from '../../../../../lib/security/authRateLimiter';
import { logger } from '../../../../../lib/logger';
import { prisma } from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

const ROUTE = 'otp-send';

type Purpose = 'register' | 'login' | 'link' | 'reauth' | 'reset';

/**
 * POST /api/auth/phone/send-otp { phone, country?, purpose, username? }
 *
 * Texts a one-time code to `phone`. Each purpose is checked up front so no
 * SMS (which costs money and is the SMS-pumping attack surface) goes out
 * for a request that can't succeed:
 *   - register: `username` must be valid and free, and the number unused.
 *   - login:    the number must belong to an account.
 *   - reset:    same as login — "Forgot password" (2026-10-28).
 *   - link:     signed in, and the number not on another account.
 *   - reauth:   signed in; always texts the account's OWN stored number
 *               (the `phone` field is ignored) — used to confirm sensitive
 *               actions such as account deletion on passwordless accounts.
 * Telling the caller whether a number is registered is deliberate: the
 * sign-in/sign-up form has to say "sign in instead" / "create an account",
 * and both limits below bound how fast anyone can probe numbers.
 */
export async function POST(request: NextRequest) {
  try {
    const ipLimit = await checkIpRateLimit(ROUTE, getClientIp(request));
    if (!ipLimit.allowed) {
      return rateLimitResponse('Too many code requests from this network. Please try again later.', ipLimit.retryAfterSec!);
    }

    const body = await request.json().catch(() => ({}));
    const purpose = body?.purpose as Purpose;
    if (purpose !== 'register' && purpose !== 'login' && purpose !== 'link' && purpose !== 'reauth' && purpose !== 'reset') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    let phone: string | null;
    if (purpose === 'reauth') {
      const authUser = await getAuthUserFromRequest(request);
      if (!authUser) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
      const account = await prisma.user.findUnique({ where: { id: authUser.id }, select: { phone: true } });
      phone = account?.phone ?? null;
      if (!phone) {
        return NextResponse.json({ error: 'This account has no phone number to send a code to.', code: 'NO_PHONE' }, { status: 400 });
      }
    } else {
      phone = normalizePhone(String(body?.phone ?? ''), String(body?.country ?? 'IN'));
    }
    if (!phone) {
      return NextResponse.json({ error: 'Enter a valid mobile number.', code: 'INVALID_PHONE' }, { status: 400 });
    }

    // Counts every send to this number (not only failures): resends are
    // what an SMS-pumping attacker repeats.
    const phoneLimit = await checkAccountRateLimit(ROUTE, phone);
    if (!phoneLimit.allowed) {
      return rateLimitResponse('Too many codes sent to this number. Please try again in 15 minutes.', phoneLimit.retryAfterSec!);
    }

    const ownerId = await findUserIdByPhone(phone);

    if (purpose === 'register') {
      const usernameError = validateUsername(String(body?.username ?? ''));
      if (usernameError) return NextResponse.json({ error: usernameError, code: 'INVALID_USERNAME' }, { status: 400 });
      if (await isUsernameTaken(String(body.username))) {
        return NextResponse.json({ error: 'This username has been taken.', code: 'USERNAME_TAKEN' }, { status: 409 });
      }
      if (ownerId) {
        return NextResponse.json(
          { error: 'This number already has an OTAKUVA account. Sign in instead.', code: 'PHONE_IN_USE' },
          { status: 409 }
        );
      }
    } else if (purpose === 'login' || purpose === 'reset') {
      if (!ownerId) {
        return NextResponse.json(
          { error: 'No account uses this number yet. Create an account instead.', code: 'PHONE_NOT_REGISTERED' },
          { status: 404 }
        );
      }
    } else if (purpose === 'link') {
      const authUser = await getAuthUserFromRequest(request);
      if (!authUser) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
      if (ownerId && ownerId !== authUser.id) {
        return NextResponse.json(
          { error: 'This number is already linked to another account.', code: 'PHONE_IN_USE' },
          { status: 409 }
        );
      }
    }

    await recordAccountFailure(ROUTE, phone);
    const sent = await sendOtp(phone);
    if (!sent.ok) {
      const responses: Record<OtpSendFailureReason, { status: number; error: string }> = {
        invalid_number: { status: 400, error: "That number can't receive SMS. Check it and try again." },
        unsupported_region: { status: 400, error: "We can't send codes to this country yet." },
        rate_limited: { status: 429, error: 'Too many codes sent to this number. Please wait a few minutes.' },
        opted_out: { status: 400, error: 'This number has blocked our messages (replied STOP). Text START to unblock, then try again.' },
        // Only reachable while the SMS account is on a Twilio trial.
        trial_unverified_number: {
          status: 400,
          error: "We can't text this number yet — sign-up by SMS is still in testing. Please try again later.",
        },
        unavailable: { status: 503, error: "We couldn't send the code right now. Please try again shortly." },
      };
      const r = responses[sent.reason];
      return NextResponse.json(
        {
          error: r.error,
          code: 'OTP_SEND_FAILED',
          reason: sent.reason,
          // Developers see the provider's real reason in the form; users in production never do.
          ...(process.env.NODE_ENV !== 'production' && sent.providerError
            ? { devDetail: `Twilio error ${sent.providerError.code ?? '?'}: ${sent.providerError.message ?? 'no message'}` }
            : {}),
        },
        { status: r.status }
      );
    }

    return NextResponse.json({
      sent: true,
      // reauth never echoes the number: the client only ever sees it masked.
      ...(purpose === 'reauth' ? {} : { phone }),
      // Lets the form say "check the server log" in development instead of
      // implying an SMS went out when none did.
      devMode: isDevOtpSender() || undefined,
      // PHONE_OTP_MODE=mock only (never in production): hand the code to the form so testing needs no SMS.
      mockCode: isMockOtpMode() ? peekDevOtp(phone) ?? undefined : undefined,
    });
  } catch (err) {
    logger.error('Sending phone OTP failed', { error: err as Error, component: 'auth/phone/send-otp' });
    return NextResponse.json({ error: "We couldn't send the code right now." }, { status: 500 });
  }
}
