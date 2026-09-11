import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { createCommunityPost, canUserViewCommunityContent } from '../../../../../lib/engine/community/communityEngine';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const channelSlug = searchParams.get('channel');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const community = await prisma.community.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      select: { id: true, visibility: true, ownerId: true, status: true },
    });

    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const authUser = await getAuthUserFromRequest(request);
    if (!(await canUserViewCommunityContent(community, authUser?.id))) {
      return NextResponse.json({ error: 'Access denied: Private community membership required' }, { status: 403 });
    }

    const where: any = {
      communityId: community.id,
      status: { notIn: ['HIDDEN'] },
    };

    if (channelSlug) {
      const channel = await prisma.communityChannel.findFirst({
        where: { communityId: community.id, slug: channelSlug },
      });
      if (channel) where.channelId = channel.id;
    }

    const [discussions, total] = await Promise.all([
      prisma.discussion.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'desc' }, { createdAt: 'desc' }], // Pinned discussions first
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
          channel: { select: { id: true, name: true, slug: true } },
          anime: { select: { id: true, canonicalTitle: true, slug: true, posterUrl: true } },
          _count: { select: { comments: true, reactions: true } },
        },
      }),
      prisma.discussion.count({ where }),
    ]);

    return NextResponse.json({
      discussions: discussions.map((d) => ({
        id: d.id,
        title: d.title,
        body: d.body,
        type: d.type,
        status: d.status,
        spoilerLevel: d.spoilerLevel,
        replyCount: d._count.comments || d.replyCount,
        helpfulCount: d._count.reactions || d.helpfulCount,
        createdAt: d.createdAt.toISOString(),
        author: d.author,
        channel: d.channel,
        anime: d.anime,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching community posts:', error);
    return NextResponse.json({ error: 'Failed to fetch community posts' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { slug } = params;
    const community = await prisma.community.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      select: { id: true },
    });

    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, body: postBody, type, spoilerLevel, channelId, animeId, episodeId } = body;

    if (!title?.trim() || !postBody?.trim()) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    const post = await createCommunityPost({
      authorId: authUser.id,
      communityId: community.id,
      channelId,
      title: title.trim(),
      body: postBody.trim(),
      type,
      spoilerLevel,
      animeId,
      episodeId,
    });

    return NextResponse.json({ success: true, post }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating post:', error);
    const status = error.message.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Failed to create post' }, { status });
  }
}
