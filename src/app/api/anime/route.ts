import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '../../../lib/api/apiHandler';
import { validateAnimeQueryParams } from '../../../lib/security/apiValidator';
import { AnimeCatalogEngine } from '../../../lib/engine/anime/animeCatalogEngine';
import { getAuthUserFromRequest } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler('AnimeCatalog', async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const validation = validateAnimeQueryParams(searchParams);

  if (!validation.isValid) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_QUERY_PARAMS',
          message: 'Invalid query parameters provided',
          details: validation.errors,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 400 }
    );
  }

  const authUser = await getAuthUserFromRequest(request);
  const result = await AnimeCatalogEngine.queryAnimeCatalog(validation.data, authUser?.id);

  return {
    data: result.items,
    animes: result.items, // backwards-compatibility envelope
    meta: result.pagination,
    pagination: result.pagination, // backwards-compatibility envelope
    cached: result.cached,
  };
});
