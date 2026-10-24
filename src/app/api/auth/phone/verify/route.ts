import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { normalizePhone } from '../../../../../lib/identity/phoneNumber';
import { findUserIdByPhone } from '../../../../../lib/identity/accountLookup';
import { verifyOtpOrRespond } from '../../../../../lib/identity/otpRoute';
import { SESSION_USER_SELECT, toSessionUser } from '../../../../../lib/identity/sessionUser';
import { logger } from '../../../../../lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/phone/verify { phone, country?, code }
 *
 * Links and verifies a phone number on the signed-in account — how legacy
 * email/password accounts unlock rating, reviewing and posting. Code
 * requested first via POST /api/auth/phone/send-otp (purpose "link").
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const phone = normalizePhone(String(body?.phone ?? ''), String(body?.country ?? 'IN'));
    if (!phone) {
      return NextResponse.json({ error: 'Enter a valid mobile number.', code: 'INVALID_PHONE' }, { status: 400 });
    }

    const ownerId = await findUserIdByPhone(phone);
    if (ownerId && ownerId !== authUser.id) {
      return NextResponse.json({ error: 'This number is already linked to another account.', code: 'PHONE_IN_USE' }, { status: 409 });
    }

    const otpFailure = await verifyOtpOrRespond(phone, body?.code);
    if (otpFailure) return otpFailure;

    try {
      const user = await prisma.user.update({
        where: { id: authUser.id },
        data: { phone, phoneVerifiedAt: new Date() },
        select: SESSION_USER_SELECT,
      });
      return NextResponse.json({ user: toSessionUser(user), message: 'Phone verified. You can now rate, review and post.' });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return NextResponse.json({ error: 'This number is already linked to another account.', code: 'PHONE_IN_USE' }, { status: 409 });
      }
      throw err;
    }
  } catch (error) {
    logger.error('Phone verification failed', { error: error as Error, component: 'auth/phone/verify' });
    return NextResponse.json({ error: 'Failed to verify phone number.' }, { status: 500 });
  }
}
