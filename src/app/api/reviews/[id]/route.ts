import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { updateReview, deleteReview } from '../../../../lib/engine/review/reviewIntelligence';
import { sanitizeReviewTags } from '../../../../lib/reviews/reviewTags';
import { setReviewTags } from '../../../../lib/reviews/reviewSocial';
import { logger } from '../../../../lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        anime: {
          select: {
            id: true,
            slug: true,
            canonicalTitle: true,
            posterUrl: true,
            type: true,
            year: true,
          },
        },
        aspects: true,
      },
    });

    if (!review || review.deletedAt) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    return NextResponse.json({ review });
  } catch (error: any) {
    console.error('Error fetching review:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch review' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    // `rating` is ignored: a review's score is the author's rating from the rating section.
    const { title, body: reviewBody, spoilerLevel, containsSpoiler } = body;

    if (title !== undefined && title.trim().length > 120) {
      return NextResponse.json({ error: 'Review headline cannot exceed 120 characters' }, { status: 400 });
    }

    if (reviewBody !== undefined && (reviewBody.trim().length < 20 || reviewBody.trim().length > 5000)) {
      return NextResponse.json({ error: 'Review body must be between 20 and 5,000 characters' }, { status: 400 });
    }

    const result = await updateReview({
      userId: authUser.id,
      reviewId: id,
      title: title?.trim(),
      body: reviewBody?.trim(),
      spoilerLevel,
      containsSpoiler,
    });

    // updateReview has already enforced ownership; tags follow the same review.
    const tags = sanitizeReviewTags(body.tags);
    let tagsSaved = true;
    if (tags !== null) {
      try {
        const owned = await prisma.review.findFirst({ where: { id, userId: authUser.id, deletedAt: null }, select: { animeId: true } });
        if (owned) await setReviewTags(id, owned.animeId, tags);
      } catch (err) {
        // The edit itself succeeded; don't report the whole update as failed.
        tagsSaved = false;
        logger.error('Updating review tags failed; review edit kept', { error: err, reviewId: id, route: '/api/reviews/[id]', method: 'PATCH' });
      }
    }

    return NextResponse.json({ success: true, ...result, ...(tags !== null ? { tags, tagsSaved } : {}) });
  } catch (error: any) {
    console.error('Error updating review:', error);
    const status = error.message.includes('Unauthorized') ? 403 : error.message === 'Review not found' ? 404 : 500;
    return NextResponse.json({ error: error.message || 'Failed to update review' }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = params;
    const isAdmin = authUser.role === 'ADMIN' || authUser.role === 'SUPER_ADMIN' || authUser.role === 'MODERATOR';

    const result = await deleteReview(authUser.id, id, isAdmin);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting review:', error);
    const status = error.message.includes('Unauthorized') ? 403 : error.message === 'Review not found' ? 404 : 500;
    return NextResponse.json({ error: error.message || 'Failed to delete review' }, { status });
  }
}
