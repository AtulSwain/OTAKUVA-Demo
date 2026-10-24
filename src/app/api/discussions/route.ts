import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { notifyFollowersOfDiscussion } from '../../../lib/social/followService';
import { getAuthUserFromRequest, requireVerifiedUser } from '../../../lib/auth';
import { readableDiscussionsFilter } from '../../../lib/engine/community/communityEngine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'trending'; // 'trending', 'latest', 'popular', 'unanswered'
    const communityId = searchParams.get('communityId');
    const channelId = searchParams.get('channelId');
    const animeId = searchParams.get('animeId');
    const episodeId = searchParams.get('episodeId');
    const type = searchParams.get('type');
    const query = searchParams.get('q');
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '25', 10) || 25));

    const authUser = await getAuthUserFromRequest(request);

    // Visibility is enforced in the query itself, so a PRIVATE community's
    // threads never reach a non-member through this cross-community list.
    const conditions: any[] = [readableDiscussionsFilter(authUser?.id)];

    let where: any = {
      status: { not: 'HIDDEN' },
      AND: conditions,
    };

    if (communityId === 'null' || communityId === 'public') {
      where.communityId = null; // Public discussions only!
    } else if (communityId) {
      // Resolve ID or slug
      const comm = await prisma.community.findFirst({
        where: {
          OR: [{ id: communityId }, { slug: communityId }],
        },
        select: { id: true },
      });
      if (comm) {
        where.communityId = comm.id;
      } else {
        where.communityId = communityId;
      }
    }

    if (channelId) where.channelId = channelId;
    if (animeId) {
      // Anime pages pass their URL segment, which is usually the slug.
      const anime = await prisma.anime.findFirst({
        where: { OR: [{ id: animeId }, { slug: animeId }] },
        select: { id: true },
      });
      where.animeId = anime?.id ?? animeId;
    }
    if (episodeId) where.episodeId = episodeId;
    if (type && type !== 'ALL') where.type = type.toUpperCase();

    if (query && query.trim()) {
      // `mode: 'insensitive'` needs Postgres — the SQLite connector this
      // ran on originally rejected it outright, and SQLite's LIKE is
      // already case-insensitive for ASCII, so this was omitted (see the
      // 'discussion search no longer 500s on SQLite' test, which predates
      // the Postgres migration). Without it here, "TEST" wouldn't match a
      // discussion titled "test" on Postgres, same silent case-sensitivity
      // regression flagged across search.ts et al.
      const q = query.trim();
      conditions.push({
        OR: [{ title: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }],
      });
    }

    if (sort === 'unanswered') {
      where.replyCount = 0;
    }

    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'trending') {
      orderBy = [{ helpfulCount: 'desc' }, { replyCount: 'desc' }, { createdAt: 'desc' }];
    } else if (sort === 'popular') {
      orderBy = [{ replyCount: 'desc' }, { helpfulCount: 'desc' }];
    } else if (sort === 'latest') {
      orderBy = { createdAt: 'desc' };
    }

    const discussions = await prisma.discussion.findMany({
      where,
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        anime: { select: { id: true, canonicalTitle: true, slug: true, posterUrl: true } },
        episode: { select: { id: true, number: true, title: true } },
        community: { select: { id: true, name: true, slug: true, iconUrl: true } },
        channel: { select: { id: true, name: true, slug: true } },
        _count: { select: { comments: true, followers: true, reactions: true } },
      },
      orderBy,
      take: limit,
    });

    // Check followed & reacted states for authenticated user
    let userFollowedIds = new Set<string>();
    let userReactedIds = new Set<string>();

    if (authUser) {
      const follows = await prisma.discussionFollower.findMany({
        where: {
          userId: authUser.id,
          discussionId: { in: discussions.map((d: any) => d.id) },
        },
      });
      follows.forEach((f) => userFollowedIds.add(f.discussionId));

      const reactions = await prisma.discussionReaction.findMany({
        where: {
          userId: authUser.id,
          discussionId: { in: discussions.map((d: any) => d.id) },
        },
      });
      reactions.forEach((r) => userReactedIds.add(r.discussionId));
    }

    const formatted = discussions.map((d: any) => ({
      id: d.id,
      title: d.title,
      body: d.body,
      type: d.type,
      spoilerLevel: d.spoilerLevel,
      status: d.status,
      replyCount: d._count?.comments ?? d.replyCount,
      helpfulCount: d._count?.reactions ?? d.helpfulCount,
      followerCount: d._count?.followers ?? 0,
      createdAt: d.createdAt.toISOString(),
      author: d.author,
      anime: d.anime,
      episode: d.episode,
      community: d.community,
      channel: d.channel,
      isFollowed: userFollowedIds.has(d.id),
      hasReacted: userReactedIds.has(d.id),
    }));

    return NextResponse.json({
      discussions: formatted,
      total: formatted.length,
    });
  } catch (error: any) {
    console.error('Error fetching discussions:', error);
    return NextResponse.json({ error: 'Failed to fetch discussions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await requireVerifiedUser(request);
    if (authUser instanceof NextResponse) return authUser;

    const body = await request.json();
    const { title, body: content, type, spoilerLevel, animeId, episodeId, communityId, channelId } = body;

    if (!title || title.trim().length < 5) {
      return NextResponse.json({ error: 'Discussion title must be at least 5 characters' }, { status: 400 });
    }

    if (!content || content.trim().length < 10) {
      return NextResponse.json({ error: 'Discussion body must be at least 10 characters' }, { status: 400 });
    }

    // A bad anime id used to surface as a foreign-key 500.
    let resolvedAnimeId: string | null = null;
    if (animeId) {
      const anime = await prisma.anime.findFirst({ where: { OR: [{ id: String(animeId) }, { slug: String(animeId) }] }, select: { id: true } });
      if (!anime) return NextResponse.json({ error: 'Anime not found' }, { status: 400 });
      resolvedAnimeId = anime.id;
    }

    let resolvedCommunityId: string | null = null;
    let resolvedChannelId: string | null = null;

    // If community discussion, verify active membership or ownership
    if (communityId) {
      const community = await prisma.community.findFirst({
        where: {
          OR: [{ id: communityId }, { slug: communityId }],
        },
        include: { channels: true },
      });

      if (!community) {
        return NextResponse.json({ error: 'Community not found' }, { status: 404 });
      }

      resolvedCommunityId = community.id;

      const isOwner = community.ownerId === authUser.id;
      const membership = await prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId: authUser.id,
          },
        },
      });

      if (!isOwner && (!membership || membership.status !== 'ACTIVE')) {
        return NextResponse.json({ error: 'You must be an active member of this community to post here' }, { status: 403 });
      }

      // Verify or assign channel
      if (channelId) {
        const matchingChannel = community.channels.find((c) => c.id === channelId || c.slug === channelId);
        if (matchingChannel) {
          resolvedChannelId = matchingChannel.id;
        } else if (community.channels.length > 0) {
          resolvedChannelId = community.channels[0].id;
        }
      } else if (community.channels.length > 0) {
        resolvedChannelId = community.channels[0].id;
      }
    }

    const discussion = await prisma.discussion.create({
      data: {
        authorId: authUser.id,
        title: title.trim(),
        body: content.trim(),
        type: (type || 'GENERAL').toUpperCase(),
        spoilerLevel: (spoilerLevel || 'NO_SPOILER').toUpperCase(),
        animeId: resolvedAnimeId,
        episodeId: episodeId || null,
        communityId: resolvedCommunityId,
        channelId: resolvedChannelId,
      },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        anime: { select: { id: true, canonicalTitle: true, slug: true, posterUrl: true } },
        episode: { select: { id: true, number: true, title: true } },
        community: { select: { id: true, name: true, slug: true } },
      },
    });

    // Auto-follow discussion for creator
    await prisma.discussionFollower.create({
      data: {
        discussionId: discussion.id,
        userId: authUser.id,
      },
    });

    // Log Activity
    await prisma.activity.create({
      data: {
        userId: authUser.id,
        type: 'DISCUSSION_CREATED',
        metadata: JSON.stringify({ discussionId: discussion.id, title: discussion.title }),
      },
    });

    // "Active in the community" for followers — public threads only, once a day.
    await notifyFollowersOfDiscussion(authUser.id, discussion.id);

    return NextResponse.json({ success: true, discussion }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating discussion:', error);
    return NextResponse.json({ error: error.message || 'Failed to create discussion' }, { status: 500 });
  }
}
