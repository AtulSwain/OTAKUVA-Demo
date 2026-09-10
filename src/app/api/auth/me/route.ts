import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../lib/auth';

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
        id: true,
        username: true,
        email: true,
        role: true,
        avatarUrl: true,
        bannerUrl: true,
        bio: true,
        createdAt: true,
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

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Session error:', error);
    return NextResponse.json({ error: 'Failed to fetch user session' }, { status: 500 });
  }
}
