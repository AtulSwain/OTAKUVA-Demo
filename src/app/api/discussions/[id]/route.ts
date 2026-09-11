import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { canUserViewCommunityContent } from '../../../../lib/engine/community/communityEngine';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const authUser = await getAuthUserFromRequest(request);

    const discussion: any = await prisma.discussion.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        anime: { select: { id: true, canonicalTitle: true, slug: true, posterUrl: true, bannerUrl: true } },
        episode: { select: { id: true, number: true, title: true } },
        community: { select: { id: true, name: true, slug: true, iconUrl: true, visibility: true, ownerId: true, status: true } },
        channel: { select: { id: true, name: true, slug: true } },
        comments: {
          where: { deletedAt: null },
          include: {
            author: { select: { id: true, username: true, avatarUrl: true } },
            reactions: true,
            replies: {
              where: { deletedAt: null },
              include: {
                author: { select: { id: true, username: true, avatarUrl: true } },
                reactions: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { comments: true, followers: true, reactions: true },
        },
      },
    });

    if (!discussion) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    }

    // A thread inside a PRIVATE community is that community's content: the
    // same membership rule as its posts list applies, however the id was
    // obtained.
    if (discussion.community && !(await canUserViewCommunityContent(discussion.community, authUser?.id))) {
      return NextResponse.json({ error: 'Access denied: Private community membership required' }, { status: 403 });
    }
    if (discussion.community) {
      const { visibility, ownerId, status, ...publicCommunity } = discussion.community;
      discussion.community = publicCommunity;
    }

    let isFollowed = false;
    let hasReacted = false;

    if (authUser) {
      const follow = await prisma.discussionFollower.findUnique({
        where: { discussionId_userId: { discussionId: id, userId: authUser.id } },
      });
      isFollowed = Boolean(follow);

      const reaction = await prisma.discussionReaction.findUnique({
        where: { discussionId_userId_type: { discussionId: id, userId: authUser.id, type: 'HELPFUL' } },
      });
      hasReacted = Boolean(reaction);
    }

    return NextResponse.json({
      discussion: {
        ...discussion,
        replyCount: discussion._count?.comments ?? discussion.replyCount,
        helpfulCount: discussion._count?.reactions ?? discussion.helpfulCount,
        followerCount: discussion._count?.followers ?? 0,
        isFollowed,
        hasReacted,
      },
    });
  } catch (error: any) {
    console.error('Error fetching discussion details:', error);
    return NextResponse.json({ error: 'Failed to fetch discussion' }, { status: 500 });
  }
}
