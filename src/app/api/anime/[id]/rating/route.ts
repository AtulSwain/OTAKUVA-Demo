import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { getAnimeBySlugOrId } from '../../../../../lib/animeData';
import {
  submitUserRating,
  deleteUserRating,
  getUserRating,
} from '../../../../../lib/rating/ratingService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/anime/:id/rating
 * Returns the authenticated user's rating & category scores for this anime
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json(
        { authenticated: false, hasRated: false, yourRating: null },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        }
      );
    }

    const anime = await getAnimeBySlugOrId(params.id);
    if (!anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    const userRating = await getUserRating(authUser.id, anime.id);

    return NextResponse.json(
      {
        authenticated: true,
        animeId: anime.id,
        ...userRating,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching user rating:', error);
    return NextResponse.json({ error: 'Failed to fetch rating' }, { status: 500 });
  }
}

/**
 * POST /api/anime/:id/rating
 * Creates or updates user rating (1.0 to 10.0, 0.1 precision) with optional category ratings
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required to submit rating' }, { status: 401 });
    }

    const anime = await getAnimeBySlugOrId(params.id);
    if (!anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    const body = await request.json();
    const { score, categoryScores } = body;

    if (score === undefined || score === null) {
      return NextResponse.json({ error: 'Score is required (0.5 to 10.0 in 0.5 increments)' }, { status: 400 });
    }

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const rating = await submitUserRating({
      userId: authUser.id,
      animeId: anime.id,
      score: parseFloat(score),
      categoryScores,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: 'Rating saved successfully',
      ratingId: rating.id,
      score: rating.rating,
    });
  } catch (error: any) {
    console.error('Error saving user rating:', error);
    return NextResponse.json(
      { error: error.message || 'Unable to save your rating. Please try again.' },
      { status: 400 }
    );
  }
}

/**
 * PATCH /api/anime/:id/rating
 * Alias for update
 */
export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  return POST(request, context);
}

/**
 * DELETE /api/anime/:id/rating
 * Removes / soft-deletes the user's rating
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const anime = await getAnimeBySlugOrId(params.id);
    if (!anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    const res = await deleteUserRating(authUser.id, anime.id);

    return NextResponse.json(res);
  } catch (error: any) {
    console.error('Error deleting user rating:', error);
    return NextResponse.json({ error: 'Failed to delete rating' }, { status: 500 });
  }
}
