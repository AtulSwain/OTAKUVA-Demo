import { NextRequest, NextResponse } from 'next/server';
import { signPhonePass, PHONE_PASS_TTL_SEC, type PhonePassPurpose } from '../../../../../lib/auth';
import { normalizePhone } from '../../../../../lib/identity/phoneNumber';
import { findUserIdByPhone } from '../../../../../lib/identity/accountLookup';
import { verifyOtpOrRespond } from '../../../../../lib/identity/otpRoute';
import { checkIpRateLimit, rateLimitResponse, getClientIp } from '../../../../../lib/security/authRateLimiter';
import { logger } from '../../../../../lib/logger';

export const dynamic = 'force-dynamic';

const ROUTE = 'otp-verify';

/**
 * POST /api/auth/phone/verify-code { phone, country?, code, purpose: 'register' | 'reset' }
 *
 * Step 2 of sign-up and of "Forgot password" (2026-10-28): checks the SMS
 * code and returns a short-lived signed pass for that phone. The client
 * then asks for the password and sends { pass, password } to
 * /api/auth/register or /api/auth/password-reset/phone. The code alone never
 * signs anyone in.
 */
export async function POST(request: NextRequest) {
  try {
    const ipLimit = await checkIpRateLimit(ROUTE, getClientIp(request));
    if (!ipLimit.allowed) {
      return rateLimitResponse('Too many attempts from this network. Please try again later.', ipLimit.retryAfterSec!);
    }
    const body = await request.json().catch(() => ({}));
    const purpose = body?.purpose as PhonePassPurpose;
    if (purpose !== 'register' && purpose !== 'reset') {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const phone = normalizePhone(String(body?.phone ?? ''), String(body?.country ?? 'IN'));
    if (!phone) return NextResponse.json({ error: 'Enter a valid mobile number.', code: 'INVALID_PHONE' }, { status: 400 });

    // Checked before the code (a provider check consumes it).
    const ownerId = await findUserIdByPhone(phone);
    if (purpose === 'register' && ownerId) {
      return NextResponse.json({ error: 'This number already has an OTAKUVA account. Sign in instead.', code: 'PHONE_IN_USE' }, { status: 409 });
    }
    if (purpose === 'reset' && !ownerId) {
      return NextResponse.json({ error: 'No account uses this number.', code: 'PHONE_NOT_REGISTERED' }, { status: 404 });
    }

    const otpFailure = await verifyOtpOrRespond(phone, body?.code);
    if (otpFailure) return otpFailure;

    return NextResponse.json({ pass: signPhonePass(phone, purpose), expiresInSec: PHONE_PASS_TTL_SEC }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('Phone code verification failed', { error: error as Error, component: 'auth/verify-code' });
    return NextResponse.json({ error: 'Could not verify the code.' }, { status: 500 });
  }
}
