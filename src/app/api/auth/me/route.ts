import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { SESSION_USER_SELECT, toSessionUser } from '../../../../lib/identity/sessionUser';
import { logger } from '../../../../lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);

    if (!authUser) {
      return NextResponse.json({ user: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        ...SESSION_USER_SELECT,
        // Read only to derive hasPassword below; the hash never leaves the server.
        passwordHash: true,
        _count: {
          select: {
            library: true,
            ratings: true,
            reviews: true,
            customLists: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ user: null });
    }

    // "Active users" for the control center: last seen, written at most every
    // 5 minutes per account (raw SQL: newer column than some running clients).
    await prisma.$executeRaw`
      UPDATE "User" SET "lastSeenAt" = NOW()
      WHERE id = ${user.id} AND ("lastSeenAt" IS NULL OR "lastSeenAt" < NOW() - INTERVAL '5 minutes')`.catch(() => undefined);

    // hasPassword tells Settings how to confirm account deletion (password,
    // or a texted code for phone sign-up accounts).
    return NextResponse.json({ user: { ...toSessionUser(user), hasPassword: Boolean(user.passwordHash), _count: user._count } });
  } catch (error: any) {
    logger.error('Session lookup failed', { error, route: '/api/auth/me', method: 'GET' });
    return NextResponse.json({ error: 'Failed to fetch user session' }, { status: 500 });
  }
}
