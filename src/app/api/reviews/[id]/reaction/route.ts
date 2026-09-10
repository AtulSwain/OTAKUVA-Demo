import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { reactToReview } from '../../../../../lib/engine/review/reviewIntelligence';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const reactionType = body.reactionType || 'HELPFUL';

    const result = await reactToReview(authUser.id, id, reactionType);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error reacting to review:', error);
    const status = error.message === 'Review not found' ? 404 : 500;
    return NextResponse.json({ error: error.message || 'Failed to react to review' }, { status });
  }
}
