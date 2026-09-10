import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { banCommunityMember, unbanCommunityMember } from '../../../../../lib/engine/community/communityEngine';

export const dynamic = 'force-dynamic';

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
    const { targetUserId, reason, durationHours } = body;

    if (!targetUserId || !reason) {
      return NextResponse.json({ error: 'targetUserId and reason are required' }, { status: 400 });
    }

    const result = await banCommunityMember(
      authUser.id,
      community.id,
      targetUserId,
      reason,
      durationHours
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error banning member:', error);
    const status = error.message.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Failed to ban member' }, { status });
  }
}

export async function DELETE(
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

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId parameter required' }, { status: 400 });
    }

    const result = await unbanCommunityMember(authUser.id, community.id, targetUserId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error unbanning member:', error);
    const status = error.message.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Failed to unban member' }, { status });
  }
}
