import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { canUserViewCommunityContent, getMemberPermission } from '../../../../lib/engine/community/communityEngine';

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
        episode: { select: { id: true, number: true, title: true, airedAt: true } },
        community: {
          select: {
            id: true, name: true, slug: true, iconUrl: true, visibility: true, ownerId: true, status: true,
            rules: { orderBy: { position: 'asc' }, take: 6, select: { id: true, title: true, content: true } },
          },
        },
        channel: { select: { id: true, name: true, slug: true } },
        // Comments are no longer embedded: they are paginated through
        // GET /api/discussions/:id/comments. Embedding returned every comment
        // at once, and listed each reply twice (top level and nested).
        _count: {
          select: { comments: { where: { deletedAt: null } }, followers: true, reactions: true },
        },
      },
    });

    // A thread removed by moderators is gone for readers, not just unlisted.
    if (!discussion || discussion.status === 'HIDDEN') {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    }

    // A thread inside a PRIVATE community is that community's content: the
    // same membership rule as its posts list applies, however the id was
    // obtained.
    if (discussion.community && !(await canUserViewCommunityContent(discussion.community, authUser?.id))) {
      return NextResponse.json({ error: 'Access denied: Private community membership required' }, { status: 403 });
    }
    // Why this viewer can't comment (null = they can, or they need to sign
    // in, which the composer handles). Server-derived so the UI never guesses.
    let commentBlockedReason: string | null = null;
    if (discussion.status === 'LOCKED') {
      commentBlockedReason = 'This discussion is locked.';
    } else if (authUser && discussion.community) {
      const perm = await getMemberPermission(authUser.id, discussion.community.id);
      if (perm.isBanned) commentBlockedReason = 'You are banned from this community.';
      else if (perm.isMuted) commentBlockedReason = 'You are muted in this community.';
      else if (!perm.canPost && !perm.isOwner) {
        const pending = await prisma.communityJoinRequest.findUnique({
          where: { communityId_userId: { communityId: discussion.community.id, userId: authUser.id } },
          select: { status: true },
        });
        commentBlockedReason =
          pending?.status === 'PENDING'
            ? 'Your request to join this community is pending. You can comment once it is approved.'
            : 'Join this community to comment.';
      }
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
        commentBlockedReason,
      },
    });
  } catch (error: any) {
    console.error('Error fetching discussion details:', error);
    return NextResponse.json({ error: 'Failed to fetch discussion' }, { status: 500 });
  }
}
