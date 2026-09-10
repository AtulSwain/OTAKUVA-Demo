import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '../../../../lib/api/apiHandler';
import { validateIdOrSlug } from '../../../../lib/security/apiValidator';
import { SeasonEngine } from '../../../../lib/engine/anime/seasonEngine';
import { getAuthUserFromRequest } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler('SeasonDetail', async (request: NextRequest, { params }: { params: { id: string } }) => {
  const validation = validateIdOrSlug(params.id);

  if (!validation.isValid) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_IDENTIFIER',
          message: validation.error || 'Invalid season identifier',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 400 }
    );
  }

  const authUser = await getAuthUserFromRequest(request);
  const result = await SeasonEngine.getSeasonDetail(validation.value, authUser?.id);

  if (!result) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Season not found for id: ${validation.value}`,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 404 }
    );
  }

  return {
    data: result.season,
    season: result.season,
    anime: result.anime,
  };
});
