import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { studioAffinityService } from '../../../../../lib/engine/studio/studioAffinityService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required for personalized studio affinity.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const [affinityProfile, recommendedAnime] = await Promise.all([
      studioAffinityService.computeUserStudioAffinities(authUser.id),
      studioAffinityService.getStudioRecommendedAnime(authUser.id, limit),
    ]);

    return NextResponse.json({
      affinityProfile,
      recommendedAnime,
    });
  } catch (error: any) {
    console.error('Error in GET /api/studios/recommendations/affinity:', error);
    return NextResponse.json({ error: 'Failed to fetch studio affinity recommendations' }, { status: 500 });
  }
}
