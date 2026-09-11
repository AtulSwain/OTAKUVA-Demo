import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { getMemberPermission } from '../../../../../lib/engine/community/communityEngine';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: discussionId } = params;
    const authUser = await getAuthUserFromRequest(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required to reply' }, { status: 401 });
    }

    const body = await request.json();
    const { content, parentId, spoilerLevel } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Comment body cannot be empty' }, { status: 400 });
    }

    const discussion = await prisma.discussion.findUnique({
      where: { id: discussionId },
    });

    if (!discussion) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    }

    if (discussion.status === 'LOCKED' || discussion.status === 'HIDDEN') {
      return NextResponse.json({ error: 'This discussion is closed to new replies' }, { status: 403 });
    }

    // Replying inside a community is posting in that community: the same
    // rule as starting a thread there — an active, unbanned, unmuted member.
    if (discussion.communityId) {
      const perm = await getMemberPermission(authUser.id, discussion.communityId);
      if (!(perm.canPost || (perm.isOwner && !perm.isBanned))) {
        return NextResponse.json({ error: 'You must be an active member of this community to reply here' }, { status: 403 });
      }
    }

    // A reply must thread under a live comment of this same discussion, never
    // one borrowed from another thread.
    if (parentId) {
      const parent = await prisma.discussionComment.findUnique({
        where: { id: String(parentId) },
        select: { discussionId: true, deletedAt: true },
      });
      if (!parent || parent.discussionId !== discussionId || parent.deletedAt) {
        return NextResponse.json({ error: 'The comment you are replying to does not exist in this discussion' }, { status: 400 });
      }
    }

    // Create Comment
    const comment = await prisma.discussionComment.create({
      data: {
        discussionId,
        authorId: authUser.id,
        parentId: parentId || null,
        body: content.trim(),
        spoilerLevel: (spoilerLevel || 'NO_SPOILER').toUpperCase(),
      },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    // Increment reply count on discussion
    const totalComments = await prisma.discussionComment.count({
      where: { discussionId, deletedAt: null },
    });

    await prisma.discussion.update({
      where: { id: discussionId },
      data: { replyCount: totalComments },
    });

    // Notify Discussion Author if someone else replied
    if (discussion.authorId !== authUser.id) {
      await prisma.notification.create({
        data: {
          userId: discussion.authorId,
          type: 'REPLY_DISCUSSION',
          title: 'New reply to your discussion',
          body: `${authUser.username} replied to "${discussion.title.slice(0, 40)}..."`,
          linkUrl: `/discussions/${discussionId}`,
        },
      });
    }

    return NextResponse.json({ success: true, comment, totalComments }, { status: 201 });
  } catch (error: any) {
    console.error('Error posting comment:', error);
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 });
  }
}
