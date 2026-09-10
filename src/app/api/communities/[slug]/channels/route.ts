import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import {
  ensureDefaultCommunityChannels,
  createCommunityChannel,
  canViewCommunity,
} from '../../../../../lib/engine/community/communityEngine';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const community = await prisma.community.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      select: { id: true, visibility: true, ownerId: true, status: true },
    });

    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    const authUser = await getAuthUserFromRequest(request);
    let membership = null;
    if (authUser) {
      membership = await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: community.id, userId: authUser.id } },
        select: { status: true, role: true },
      });
    }

    if (!canViewCommunity(community, membership, authUser?.id)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await ensureDefaultCommunityChannels(community.id);

    const channels = await prisma.communityChannel.findMany({
      where: { communityId: community.id },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        position: true,
        _count: {
          select: { messages: true },
        },
      },
    });

    return NextResponse.json({ channels });
  } catch (error: any) {
    console.error('Error fetching channels:', error);
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 });
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
    const { name, type = 'TEXT' } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Channel name is required' }, { status: 400 });
    }

    const channel = await createCommunityChannel(authUser.id, community.id, {
      name: name.trim(),
      type: type === 'ANNOUNCEMENT' ? 'ANNOUNCEMENT' : 'TEXT',
    });

    return NextResponse.json({ success: true, channel }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating channel:', error);
    const status = error.message.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ error: error.message || 'Failed to create channel' }, { status });
  }
}
