import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: discussionId } = params;
    const authUser = await getAuthUserFromRequest(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const existing = await prisma.discussionFollower.findUnique({
      where: {
        discussionId_userId: {
          discussionId,
          userId: authUser.id,
        },
      },
    });

    let isFollowed = false;
    if (existing) {
      await prisma.discussionFollower.delete({
        where: { id: existing.id },
      });
      isFollowed = false;
    } else {
      await prisma.discussionFollower.create({
        data: {
          discussionId,
          userId: authUser.id,
        },
      });
      isFollowed = true;
    }

    const totalFollowers = await prisma.discussionFollower.count({
      where: { discussionId },
    });

    return NextResponse.json({ success: true, isFollowed, followerCount: totalFollowers });
  } catch (error: any) {
    console.error('Error toggling follow:', error);
    return NextResponse.json({ error: 'Failed to follow discussion' }, { status: 500 });
  }
}
