import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { newsEngine } from '../../../../../lib/engine/news/newsEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || authUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin authorization required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await newsEngine.getAdminReviewQueue(status, page, limit);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching admin review queue:', error);
    return NextResponse.json({ error: 'Failed to fetch review queue' }, { status: 500 });
  }
}
