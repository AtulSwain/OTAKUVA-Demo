import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { updateReview, deleteReview } from '../../../../lib/engine/review/reviewIntelligence';

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
    const { title, body: reviewBody, rating, spoilerLevel, containsSpoiler } = body;

    let parsedRating: number | null | undefined = undefined;
    if (rating !== undefined) {
      if (rating === null || rating === '') {
        parsedRating = null;
      } else {
        const num = Number(rating);
        if (isNaN(num) || num < 0.5 || num > 10.0) {
          return NextResponse.json({ error: 'Rating must be between 0.5 and 10.0' }, { status: 400 });
        }
        parsedRating = Math.round(num * 2) / 2;
      }
    }

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
      rating: parsedRating,
      spoilerLevel,
      containsSpoiler,
    });

    return NextResponse.json({ success: true, ...result });
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
