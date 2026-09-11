import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { newsEngine } from '../../../../../../lib/engine/news/newsEngine';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!hasMinRole(authUser.role, 'NEWS_EDITOR')) {
      return NextResponse.json({ error: 'News editor authorization required' }, { status: 403 });
    }

    const { action } = await req.json();

    if (action === 'APPROVE') {
      const result = await newsEngine.approveReviewQueueItem(authUser.id, params.id);
      return NextResponse.json(result);
    } else if (action === 'DISMISS') {
      const result = await newsEngine.dismissReviewQueueItem(authUser.id, params.id);
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ error: 'Invalid action. Must be APPROVE or DISMISS' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error resolving review queue item:', error);
    return NextResponse.json({ error: error.message || 'Failed to update review queue item' }, { status: 500 });
  }
}
