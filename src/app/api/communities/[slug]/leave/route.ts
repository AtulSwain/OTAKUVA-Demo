import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { leaveCommunity } from '../../../../../lib/engine/community/communityEngine';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const authUser = await getAuthUserFromRequest(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const result = await leaveCommunity(authUser.id, slug);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Leave community error:', error);
    const status = error.message?.includes('owner cannot leave')
      ? 400
      : error.message?.includes('not found')
      ? 404
      : 500;
    return NextResponse.json({ error: error.message || 'Failed to leave community' }, { status });
  }
}
