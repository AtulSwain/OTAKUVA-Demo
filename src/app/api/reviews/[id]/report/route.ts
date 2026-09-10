import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { reportReview } from '../../../../../lib/engine/review/reviewIntelligence';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required to report a review' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { reason, details } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }

    const report = await reportReview(authUser.id, id, reason, details);
    return NextResponse.json({ success: true, reportId: report.id });
  } catch (error: any) {
    console.error('Error reporting review:', error);
    const status = error.message === 'Review not found' ? 404 : 500;
    return NextResponse.json({ error: error.message || 'Failed to report review' }, { status });
  }
}
