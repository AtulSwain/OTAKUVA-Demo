import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { canUserViewCommunityContent } from '../../../../../lib/engine/community/communityEngine';

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

    // Reacting to or following a thread reveals and touches it, so it needs
    // the same read access as opening it.
    const discussion = await prisma.discussion.findUnique({
      where: { id: discussionId },
      select: { community: { select: { id: true, visibility: true, ownerId: true, status: true } } },
    });
    if (!discussion) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    }
    if (discussion.community && !(await canUserViewCommunityContent(discussion.community, authUser.id))) {
      return NextResponse.json({ error: 'Access denied: Private community membership required' }, { status: 403 });
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
