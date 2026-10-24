import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getAuthUserFromRequest, requireVerifiedUser } from '../../../../../lib/auth';
import { sendCommunityChatMessage, canViewCommunity } from '../../../../../lib/engine/community/communityEngine';
import { getChatAuthorMeta } from '../../../../../lib/community/chatAuthorMeta';
import { logger } from '../../../../../lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const channelParam = searchParams.get('channel');
    const channelIdParam = searchParams.get('channelId');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const community = await prisma.community.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      select: { id: true, visibility: true, ownerId: true, status: true },
    });

    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    // Verify privacy / membership authorization
    const authUser = await getAuthUserFromRequest(request);
    let membership = null;
    if (authUser) {
      membership = await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: community.id, userId: authUser.id } },
        select: { status: true, role: true },
      });
    }

    if (!canViewCommunity(community, membership, authUser?.id)) {
      return NextResponse.json({ error: 'Access denied: Private community membership required' }, { status: 403 });
    }

    let channel = null;
    if (channelIdParam) {
      channel = await prisma.communityChannel.findFirst({
        where: { communityId: community.id, id: channelIdParam },
      });
    } else {
      channel = await prisma.communityChannel.findFirst({
        where: { communityId: community.id, slug: channelParam || 'general' },
      });
    }

    if (!channel) {
      // Auto-seed default channels if this is a legacy community without channels
      const { ensureDefaultCommunityChannels } = await import('../../../../../lib/engine/community/communityEngine');
      await ensureDefaultCommunityChannels(community.id);

      channel = await prisma.communityChannel.findFirst({
        where: { communityId: community.id, slug: channelParam || 'general' },
      }) || await prisma.communityChannel.findFirst({
        where: { communityId: community.id },
      });
    }

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const messages = await prisma.communityMessage.findMany({
      where: { channelId: channel.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    // Return in chronological order for frontend display
    messages.reverse();

    const meta = await getChatAuthorMeta(
      community.id,
      community.ownerId,
      messages.map((m) => m.authorId)
    );

    return NextResponse.json({
      channelId: channel.id,
      channelName: channel.name,
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        spoilerLevel: m.spoilerLevel,
        createdAt: m.createdAt.toISOString(),
        author: { ...m.author, ...meta.get(m.authorId) },
      })),
    });
  } catch (error: any) {
    logger.error('Error fetching chat messages', { error, route: '/api/communities/[slug]/chat', method: 'GET' });
    return NextResponse.json({ error: 'Failed to fetch chat messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const authUser = await requireVerifiedUser(request);
    if (authUser instanceof NextResponse) return authUser;

    const { slug } = params;
    const body = await request.json();
    const { channelId, body: messageBody, replyToId, spoilerLevel } = body;

    if (!channelId || !messageBody?.trim()) {
      return NextResponse.json({ error: 'channelId and body are required' }, { status: 400 });
    }

    const result = await sendCommunityChatMessage(
      authUser.id,
      channelId,
      messageBody.trim(),
      replyToId,
      spoilerLevel
    );

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error: any) {
    logger.error('Error sending chat message', { error, route: '/api/communities/[slug]/chat', method: 'POST' });
    const status = error.message.includes('Unauthorized') ? 403 : error.message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: error.message || 'Failed to send chat message' }, { status });
  }
}
