import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { recommendationRankingEngine } from '@/lib/engine/recommendation/recommendationEngine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/recommendations/debugger?userId=...
 * Inspects multi-signal taste profile, candidates generated, and ranking score breakdowns
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized: Data Editor or Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId') || user.id;

    const debugData = await recommendationRankingEngine.debugUserRecommendations(targetUserId);

    return NextResponse.json({
      success: true,
      targetUserId,
      ...debugData,
    });
  } catch (error: any) {
    console.error('Recommendation debugger API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to inspect user recommendations' },
      { status: 500 }
    );
  }
}
