import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { recommendationRankingEngine } from '@/lib/engine/recommendation/recommendationEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/recommendations
 * Returns personalized recommendations for authenticated users
 * or curated top community discovery for guest users.
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '12', 10);
    const context = url.searchParams.get('context') || 'HOME';
    const targetAnimeId = url.searchParams.get('targetAnimeId') || undefined;

    const result = await recommendationRankingEngine.getPersonalizedRecommendations(
      authUser?.id || 'guest_user',
      {
        limit,
        context,
        targetAnimeId,
      }
    );

    return NextResponse.json(
      {
        success: true,
        isAuthenticated: Boolean(authUser),
        isPersonalized: result.personalizationLevel !== 'COLD_START',
        personalizationLevel: result.personalizationLevel,
        algorithmVersion: result.algorithmVersion,
        totalCandidatesEvaluated: result.totalCandidatesEvaluated,
        recommendations: result.items,
        items: result.items,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Recommendations API error:', error);
    return NextResponse.json(
      { error: 'Unable to load recommendations. Please try again.' },
      { status: 500 }
    );
  }
}
