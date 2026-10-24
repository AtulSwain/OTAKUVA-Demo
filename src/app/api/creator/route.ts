import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../lib/auth';
import { getCreatorProfile } from '../../../lib/creator/creatorService';
import { creatorErrorResponse, NO_STORE } from '../../../lib/creator/creatorHttp';

export const dynamic = 'force-dynamic';

/** GET /api/creator — the signed-in member's role and creator profile. */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    return NextResponse.json(await getCreatorProfile(user.id), { headers: NO_STORE });
  } catch (err) {
    return creatorErrorResponse(err, 'load your creator profile');
  }
}
