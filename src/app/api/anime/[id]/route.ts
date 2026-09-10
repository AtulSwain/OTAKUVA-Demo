import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '../../../../lib/api/apiHandler';
import { validateIdOrSlug } from '../../../../lib/security/apiValidator';
import { AnimeCatalogEngine } from '../../../../lib/engine/anime/animeCatalogEngine';
import { getAuthUserFromRequest } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler('AnimeDetail', async (request: NextRequest, { params }: { params: { id: string } }) => {
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
  const anime = await AnimeCatalogEngine.getAnimeByIdOrSlug(validation.value, authUser?.id);

  if (!anime) {
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

  return {
    data: anime,
    anime, // backwards-compatibility envelope
  };
});
