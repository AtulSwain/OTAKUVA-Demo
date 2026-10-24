/**
 * Route-level wrapper around checkOtp(): per-number brute-force limit plus
 * the user-facing error responses, shared by register, login and phone
 * linking so all three refuse a bad code the same way.
 */

import { NextResponse } from 'next/server';
import { checkOtp } from './otpService';
import {
  checkAccountRateLimit,
  rateLimitResponse,
  recordAccountFailure,
  resetAccountRateLimit,
} from '../security/authRateLimiter';

const CHECK_ROUTE = 'otp-check';

/** Returns null when `code` is the valid OTP for `phone`; otherwise a response to return as-is. */
export async function verifyOtpOrRespond(phone: string, code: unknown): Promise<NextResponse | null> {
  const limit = await checkAccountRateLimit(CHECK_ROUTE, phone);
  if (!limit.allowed) {
    return rateLimitResponse('Too many wrong codes for this number. Please try again in 15 minutes.', limit.retryAfterSec!);
  }

  const result = await checkOtp(phone, typeof code === 'string' ? code.trim() : '');
  if (result.ok) {
    await resetAccountRateLimit(CHECK_ROUTE, phone);
    return null;
  }

  if (result.reason === 'unavailable') {
    return NextResponse.json(
      { error: 'Phone verification is temporarily unavailable. Please try again shortly.', code: 'OTP_UNAVAILABLE' },
      { status: 503 }
    );
  }
  await recordAccountFailure(CHECK_ROUTE, phone);
  const messages = {
    wrong_code: "That code isn't right. Check the SMS and try again.",
    expired: 'That code has expired or was already used. Request a new one.',
    too_many_attempts: 'Too many wrong codes. Request a new one.',
  } as const;
  return NextResponse.json({ error: messages[result.reason], code: 'OTP_INVALID' }, { status: 400 });
}
