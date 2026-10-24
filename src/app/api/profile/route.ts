import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

/** Shared with the profile About section and edit modal. */
const BIO_MAX_LENGTH = 500;
/** Shared with the profile edit modal's Display Name field. */
const DISPLAY_NAME_MAX_LENGTH = 40;

/** Trims, collapses whitespace, drops control characters; '' clears the name. */
function cleanDisplayName(raw: string): string | null {
  // eslint-disable-next-line no-control-regex
  const v = raw.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e]/g, '').replace(/\s+/g, ' ').trim();
  return v ? v : null;
}

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
          displayName: true,
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
          displayName: user.displayName || user.username,
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
        displayName: true,
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
        displayName: user?.displayName || user?.username,
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
    const { bio, showJoinedCommunities, displayName } = body;

    const data: any = {};
    if (typeof bio === 'string') {
      if (bio.length > BIO_MAX_LENGTH) {
        return NextResponse.json({ error: `Bio cannot exceed ${BIO_MAX_LENGTH} characters.` }, { status: 400 });
      }
      data.bio = bio.trim();
    }
    if (displayName !== undefined) {
      if (displayName !== null && typeof displayName !== 'string') {
        return NextResponse.json({ error: 'Display name must be text.' }, { status: 400 });
      }
      const name = typeof displayName === 'string' ? cleanDisplayName(displayName) : null;
      if (name && name.length > DISPLAY_NAME_MAX_LENGTH) {
        return NextResponse.json({ error: `Display name cannot exceed ${DISPLAY_NAME_MAX_LENGTH} characters.` }, { status: 400 });
      }
      data.displayName = name;
    }
    // Communities the user founded are always shown; this only hides ones they joined.
    if (typeof showJoinedCommunities === 'boolean') {
      data.showJoinedCommunities = showJoinedCommunities;
    }

    const updatedUser = await prisma.user.update({
      where: { id: authUser.id },
      data,
      select: {
        id: true,
        username: true,
        displayName: true,
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
        displayName: updatedUser.displayName || updatedUser.username,
      },
    });
  } catch (error: any) {
    console.error('Error in profile PATCH:', error);
    return NextResponse.json({ error: error.message || 'Failed to update profile' }, { status: 500 });
  }
}
