import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '../../../../../lib/api/apiHandler';
import { validateIdOrSlug } from '../../../../../lib/security/apiValidator';
import { SeasonEngine } from '../../../../../lib/engine/anime/seasonEngine';
import { getAuthUserFromRequest } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler('AnimeSeasons', async (request: NextRequest, { params }: { params: { id: string } }) => {
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

  const authUser = await getAuthUserFromRequest(request);

  try {
    const result = await SeasonEngine.getAnimeSeasons(validation.value, authUser?.id);

    return {
      data: result,
      animeId: result.animeId,
      slug: result.slug,
      directSeasons: result.directSeasons,
      franchises: result.franchises,
      seasons: result.connectedSeasons, // backwards-compatibility
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