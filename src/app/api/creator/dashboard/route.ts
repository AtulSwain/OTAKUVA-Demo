import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { getCreatorDashboard } from '../../../../lib/creator/creatorService';
import { creatorErrorResponse, NO_STORE } from '../../../../lib/creator/creatorHttp';

export const dynamic = 'force-dynamic';

/** GET /api/creator/dashboard — creators only; every number comes from real rows. */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    return NextResponse.json(await getCreatorDashboard(user.id), { headers: NO_STORE });
  } catch (err) {
    return creatorErrorResponse(err, 'load your dashboard');
  }
}
