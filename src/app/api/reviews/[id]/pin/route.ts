import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { requireRole } from '../../../../../lib/auth';
import { logger } from '../../../../../lib/logger';

export const dynamic = 'force-dynamic';

/** How many reviews one anime can have pinned at once. */
const MAX_PINNED_PER_ANIME = 3;

/**
 * POST /api/reviews/:id/pin — pin a good review to the top of its anime's
 * reviews (moderators and admins). DELETE unpins. Every pin/unpin is logged
 * as a ModerationAction.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const mod = await requireRole(request, 'MODERATOR');
    if (mod instanceof NextResponse) return mod;

    const review = await prisma.review.findUnique({
      where: { id: params.id },
      select: { id: true, animeId: true, userId: true, status: true, deletedAt: true, pinnedAt: true },
    });
    if (!review || review.deletedAt || review.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
    }
    if (review.pinnedAt) return NextResponse.json({ pinned: true, pinnedAt: review.pinnedAt.toISOString() });

    const pinnedCount = await prisma.review.count({ where: { animeId: review.animeId, pinnedAt: { not: null }, deletedAt: null } });
    if (pinnedCount >= MAX_PINNED_PER_ANIME) {
      return NextResponse.json({ error: `Up to ${MAX_PINNED_PER_ANIME} reviews can be pinned. Unpin one first.` }, { status: 409 });
    }

    const pinnedAt = new Date();
    await prisma.$transaction([
      prisma.review.update({ where: { id: review.id }, data: { pinnedAt, pinnedById: mod.id } }),
      prisma.moderationAction.create({
        data: { moderatorId: mod.id, targetUserId: review.userId, targetType: 'REVIEW', targetId: review.id, action: 'PIN' },
      }),
    ]);
    return NextResponse.json({ pinned: true, pinnedAt: pinnedAt.toISOString() });
  } catch (error) {
    logger.error('Pin review failed', { error, route: '/api/reviews/[id]/pin', method: 'POST' });
    return NextResponse.json({ error: 'Could not pin the review.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const mod = await requireRole(request, 'MODERATOR');
    if (mod instanceof NextResponse) return mod;

    const review = await prisma.review.findUnique({ where: { id: params.id }, select: { id: true, userId: true, pinnedAt: true } });
    if (!review) return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
    if (!review.pinnedAt) return NextResponse.json({ pinned: false });

    await prisma.$transaction([
      prisma.review.update({ where: { id: review.id }, data: { pinnedAt: null, pinnedById: null } }),
      prisma.moderationAction.create({
        data: { moderatorId: mod.id, targetUserId: review.userId, targetType: 'REVIEW', targetId: review.id, action: 'UNPIN' },
      }),
    ]);
    return NextResponse.json({ pinned: false });
  } catch (error) {
    logger.error('Unpin review failed', { error, route: '/api/reviews/[id]/pin', method: 'DELETE' });
    return NextResponse.json({ error: 'Could not unpin the review.' }, { status: 500 });
  }
}
