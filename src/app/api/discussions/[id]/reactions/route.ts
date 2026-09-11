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

    const existing = await prisma.discussionReaction.findUnique({
      where: {
        discussionId_userId_type: {
          discussionId,
          userId: authUser.id,
          type: 'HELPFUL',
        },
      },
    });

    let hasReacted = false;
    if (existing) {
      await prisma.discussionReaction.delete({
        where: { id: existing.id },
      });
      hasReacted = false;
    } else {
      await prisma.discussionReaction.create({
        data: {
          discussionId,
          userId: authUser.id,
          type: 'HELPFUL',
        },
      });
      hasReacted = true;
    }

    const totalHelpful = await prisma.discussionReaction.count({
      where: { discussionId, type: 'HELPFUL' },
    });

    await prisma.discussion.update({
      where: { id: discussionId },
      data: { helpfulCount: totalHelpful },
    });

    return NextResponse.json({ success: true, hasReacted, helpfulCount: totalHelpful });
  } catch (error: any) {
    console.error('Error toggling reaction:', error);
    return NextResponse.json({ error: 'Failed to react' }, { status: 500 });
  }
}
