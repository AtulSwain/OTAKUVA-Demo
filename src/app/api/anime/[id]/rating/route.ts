import { NextRequest, NextResponse } from 'next/server';
import { starRatingsEnabled, STAR_RATINGS_OFF_MESSAGE } from '../../../../../lib/rating/starRatings';
import { getAuthUserFromRequest, requireVerifiedUser } from '../../../../../lib/auth';
import { getAnimeBySlugOrId } from '../../../../../lib/animeData';
import {
  submitUserRating,
  deleteUserRating,
  getUserRating,
} from '../../../../../lib/rating/ratingService';
import { getEpisodeReleaseState, getMyEpisodeScore } from '../../../../../lib/rating/episodeRatings';
import { notifyFollowersOfCreatorRating } from '../../../../../lib/social/followService';

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

    const [userRating, episodeScore] = await Promise.all([
      getUserRating(authUser.id, anime.id),
      getMyEpisodeScore(authUser.id, anime.id),
    ]);
    // Same rule as the OTAKUVA Score: the overall rating of the anime; only a
    // member with none falls back to their legacy per-episode score average.
    const effective = userRating.hasRated
      ? { ...userRating, source: 'overall', episodesRated: 0 }
      : episodeScore
        ? { hasRated: true, yourRating: episodeScore.score, yourCategoryRatings: episodeScore.categories, source: 'episodes', episodesRated: episodeScore.episodesRated }
        : { ...userRating, source: null, episodesRated: 0 };

    return NextResponse.json(
      {
        authenticated: true,
        animeId: anime.id,
        ...effective,
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
    // 1–10 stars are switched off (owner, 2026-10-25) — see starRatings.ts.
    if (!starRatingsEnabled()) {
      return NextResponse.json({ error: STAR_RATINGS_OFF_MESSAGE, code: 'STAR_RATINGS_OFF' }, { status: 410 });
    }
    const authUser = await requireVerifiedUser(request);
    if (authUser instanceof NextResponse) return authUser;

    const anime = await getAnimeBySlugOrId(params.id);
    if (!anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    // Nothing can be rated before episode 1 has aired (server-side, not just hidden buttons).
    const release = await getEpisodeReleaseState(anime.id);
    if (!release.isOpen) {
      return NextResponse.json({ error: 'Ratings open when episode 1 airs.' }, { status: 403 });
    }

    const body = await request.json();
    const { score, categoryScores } = body;

    if (score === undefined || score === null) {
      return NextResponse.json({ error: 'Score is required (0.5 to 10.0 in 0.1 steps)' }, { status: 400 });
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

    // Creators only: their followers hear about it (once per anime).
    await notifyFollowersOfCreatorRating(authUser.id, anime.id, rating.rating);

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
