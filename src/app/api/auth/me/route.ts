import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { SESSION_USER_SELECT, toSessionUser } from '../../../../lib/identity/sessionUser';

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

    // hasPassword tells Settings how to confirm account deletion (password,
    // or a texted code for phone sign-up accounts).
    return NextResponse.json({ user: { ...toSessionUser(user), hasPassword: Boolean(user.passwordHash), _count: user._count } });
  } catch (error: any) {
    console.error('Session error:', error);
    return NextResponse.json({ error: 'Failed to fetch user session' }, { status: 500 });
  }
}
