import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { reviewIntelligenceService } from '@/lib/engine/ai/reviewIntelligenceService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/intelligence/review-analysis/[reviewId]
 * Generates/updates ReviewAnalysis NLP record
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { reviewId: string } }
) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const analysis = await reviewIntelligenceService.processAndSaveReviewAnalysis(params.reviewId);
    if (!analysis) {
      return NextResponse.json({ error: 'Review not found or analysis failed' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error: any) {
    console.error('Review analysis API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process review intelligence' },
      { status: 500 }
    );
  }
}
