import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest, requireVerifiedUser } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import {
  submitUserRating,
  deleteUserRating,
  getUserRating,
  getAnimeRatingSummary,
} from '../../../../lib/rating/ratingService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { animeId: string } }
) {
  try {
    const { animeId } = params;
    const authUser = await getAuthUserFromRequest(request);

    const anime = await prisma.anime.findFirst({
      where: { OR: [{ id: animeId }, { slug: animeId }] },
      select: { id: true, canonicalTitle: true },
    });

    if (!anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    const resolvedAnimeId = anime.id;
    const summary = await getAnimeRatingSummary(resolvedAnimeId);
    let userRating = null;

    if (authUser) {
      const rawUserRating = await getUserRating(authUser.id, resolvedAnimeId);
      if (rawUserRating) {
        userRating = {
          ...rawUserRating,
          score: rawUserRating.yourRating,
        };
      }
    }

    return NextResponse.json({
      summary,
      userRating,
    });
  } catch (error: any) {
    console.error('Error fetching anime ratings:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch ratings' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { animeId: string } }
) {
  try {
    const authUser = await requireVerifiedUser(request);
    if (authUser instanceof NextResponse) return authUser;

    const { animeId } = params;
    const body = await request.json();
    const { score, rating, categoryScores } = body;
    const rawScore = typeof score === 'number' ? score : rating;

    if (typeof rawScore !== 'number' || rawScore < 0 || rawScore > 10) {
      return NextResponse.json(
        { error: 'Rating must be a number between 0.0 and 10.0' },
        { status: 400 }
      );
    }

    const anime = await prisma.anime.findFirst({
      where: { OR: [{ id: animeId }, { slug: animeId }] },
      select: { id: true },
    });

    if (!anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    const resolvedAnimeId = anime.id;
    const ipAddress = request.headers.get('x-forwarded-for') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    await submitUserRating({
      userId: authUser.id,
      animeId: resolvedAnimeId,
      score: rawScore,
      categoryScores,
      ipAddress,
      userAgent,
    });

    const [summary, updatedUserRating] = await Promise.all([
      getAnimeRatingSummary(resolvedAnimeId),
      getUserRating(authUser.id, resolvedAnimeId),
    ]);

    return NextResponse.json({
      success: true,
      summary,
      userRating: updatedUserRating ? {
        ...updatedUserRating,
        score: updatedUserRating.yourRating,
      } : null,
    });
  } catch (error: any) {
    console.error('Error saving rating:', error);
    const status = error.message.includes('between 1.0 and 10.0') ? 400 : 500;
    return NextResponse.json({ error: error.message || 'Failed to save rating' }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { animeId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { animeId } = params;
    const anime = await prisma.anime.findFirst({
      where: { OR: [{ id: animeId }, { slug: animeId }] },
      select: { id: true },
    });

    const resolvedAnimeId = anime ? anime.id : animeId;
    const result = await deleteUserRating(authUser.id, resolvedAnimeId);
    const summary = await getAnimeRatingSummary(resolvedAnimeId);

    return NextResponse.json({ ...result, summary });
  } catch (error: any) {
    console.error('Error deleting rating:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove rating' }, { status: 500 });
  }
}
