import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const usernameParam = searchParams.get('username');

    if (usernameParam) {
      const user = await prisma.user.findFirst({
        where: { username: usernameParam },
        select: {
          id: true,
          username: true,
          bio: true,
          avatarUrl: true,
          bannerUrl: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              library: true,
              ratings: true,
              reviews: true,
              customLists: true,
              followers: true,
              following: true,
            },
          },
        },
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      return NextResponse.json({
        user: {
          ...user,
          displayName: user.username,
        },
      });
    }

    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        username: true,
        email: true,
        bio: true,
        avatarUrl: true,
        bannerUrl: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            library: true,
            ratings: true,
            reviews: true,
            customLists: true,
            followers: true,
            following: true,
          },
        },
      },
    });

    return NextResponse.json({
      user: {
        ...user,
        displayName: user?.username,
      },
    });
  } catch (error: any) {
    console.error('Error in profile GET:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required to update profile.' }, { status: 401 });
    }

    const body = await request.json();
    const { bio } = body;

    const data: any = {};
    if (typeof bio === 'string') {
      if (bio.length > 240) {
        return NextResponse.json({ error: 'Bio cannot exceed 240 characters.' }, { status: 400 });
      }
      data.bio = bio.trim();
    }

    const updatedUser = await prisma.user.update({
      where: { id: authUser.id },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        bio: true,
        avatarUrl: true,
        bannerUrl: true,
        role: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        ...updatedUser,
        displayName: updatedUser.username,
      },
    });
  } catch (error: any) {
    console.error('Error in profile PATCH:', error);
    return NextResponse.json({ error: error.message || 'Failed to update profile' }, { status: 500 });
  }
}
