import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hybridRecommendationModel } from '@/lib/engine/ai/hybridRecommendationModel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/intelligence/recommendations/hybrid
 * Returns ML-hybrid recommendations with multi-score breakdown
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '12', 10);
    const context = url.searchParams.get('context') || 'HOME';
    const targetAnimeId = url.searchParams.get('targetAnimeId') || undefined;

    const result = await hybridRecommendationModel.getHybridRecommendations(
      authUser?.id || null,
      { limit, context, targetAnimeId }
    );

    return NextResponse.json(
      {
        success: true,
        isAuthenticated: Boolean(authUser),
        ...result,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Hybrid recommendations API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate hybrid recommendations' },
      { status: 500 }
    );
  }
}
