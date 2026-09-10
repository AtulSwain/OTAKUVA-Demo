import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { getUserTasteProfile } from '../../../../lib/engine/taste/tasteEngine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const profile = await getUserTasteProfile(authUser.id);

    // Return safe user-facing representation
    return NextResponse.json({
      userId: profile.userId,
      confidenceTier: profile.confidenceTier,
      topGenres: profile.topGenres,
      topThemes: profile.topThemes,
      topStudios: profile.topStudios,
      userFacingInsights: profile.userFacingInsights,
      aspects: profile.aspects,
      updatedAt: profile.updatedAt,
    });
  } catch (error: any) {
    console.error('Error fetching user taste profile:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch taste profile' }, { status: 500 });
  }
}
