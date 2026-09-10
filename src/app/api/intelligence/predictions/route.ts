import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { predictivePersonalizationEngine } from '@/lib/engine/ai/predictivePersonalizationEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/intelligence/predictions?animeId=...
 * Generates action predictions: P(Start), P(Complete)
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const url = new URL(req.url);
    const animeId = url.searchParams.get('animeId');

    if (!animeId) {
      return NextResponse.json({ error: 'animeId is required' }, { status: 400 });
    }

    const [startPred, completePred] = await Promise.all([
      predictivePersonalizationEngine.predictStartProbability(authUser.id, animeId),
      predictivePersonalizationEngine.predictCompletionProbability(authUser.id, animeId),
    ]);

    return NextResponse.json({
      success: true,
      predictions: {
        start: startPred,
        complete: completePred,
      },
    });
  } catch (error: any) {
    console.error('Predictions API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to compute predictions' },
      { status: 500 }
    );
  }
}
