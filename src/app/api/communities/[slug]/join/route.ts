import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { joinCommunity } from '../../../../../lib/engine/community/communityEngine';

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

    let verificationData: { provider: string; token: string } | undefined;
    try {
      const body = await request.json();
      if (body?.verificationData) {
        verificationData = body.verificationData;
      }
    } catch {
      // Body may be empty for open join
    }

    const result = await joinCommunity(authUser.id, slug, verificationData);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Join community error:', error);
    const status = error.message?.includes('banned') || error.message?.includes('creator-exclusive')
      ? 403
      : error.message?.includes('not found')
      ? 404
      : 500;
    return NextResponse.json({ error: error.message || 'Failed to join community' }, { status });
  }
}
