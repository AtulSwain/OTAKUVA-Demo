import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '../../../../../lib/api/apiHandler';
import { validateIdOrSlug } from '../../../../../lib/security/apiValidator';
import { EpisodeEngine } from '../../../../../lib/engine/anime/episodeEngine';
import { getAuthUserFromRequest } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler('AnimeEpisodes', async (request: NextRequest, { params }: { params: { id: string } }) => {
  const validation = validateIdOrSlug(params.id);

  if (!validation.isValid) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_IDENTIFIER',
          message: validation.error || 'Invalid anime identifier',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const seasonId = searchParams.get('seasonId') || undefined;
  const fillerRaw = searchParams.get('filler');
  const filler = fillerRaw !== null ? fillerRaw === 'true' : undefined;

  const authUser = await getAuthUserFromRequest(request);

  try {
    const result = await EpisodeEngine.getAnimeEpisodes(
      validation.value,
      { page, limit, seasonId, filler },
      authUser?.id
    );

    return {
      data: result.episodes,
      meta: result.pagination,
      animeId: result.animeId,
      slug: result.slug,
      title: result.title,
      episodes: result.episodes,
      seasons: result.seasons,
      pagination: result.pagination,
      progress: result.progress,
    };
  } catch (err: any) {
    if (err.message === 'Anime not found') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Anime not found for identifier: ${validation.value}`,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      );
    }
    throw err;
  }
});
