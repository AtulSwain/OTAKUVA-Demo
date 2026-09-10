import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { behavioralTrackingService } from '@/lib/engine/events/behavioralTrackingService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recommendations/feedback
 * Records user feedback and interactions on recommended anime
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Sign in required' }, { status: 401 });
    }

    const body = await req.json();
    const { animeId, action, context = 'HOME' } = body;

    if (!animeId || !action) {
      return NextResponse.json({ error: 'animeId and action are required' }, { status: 400 });
    }

    const validActions = [
      'CLICKED',
      'DISMISSED',
      'MORE_LIKE_THIS',
      'LESS_LIKE_THIS',
      'NOT_INTERESTED',
      'STARTED',
    ];

    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action: ${action}. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await behavioralTrackingService.trackRecommendationAction(
      user.id,
      animeId,
      action,
      context
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Recommendation feedback API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to record recommendation feedback' },
      { status: 500 }
    );
  }
}
