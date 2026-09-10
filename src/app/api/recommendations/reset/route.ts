import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { tasteEngine } from '@/lib/engine/taste/tasteEngine';
import { recommendationRankingEngine } from '@/lib/engine/recommendation/recommendationEngine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recommendations/reset
 * Resets user's derived taste profile and recommendation cache
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Sign in required' }, { status: 401 });
    }

    const result = await tasteEngine.resetUserTasteProfile(user.id);
    recommendationRankingEngine.invalidateUserCache(user.id);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Recommendation reset API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to reset personalization profile' },
      { status: 500 }
    );
  }
}
