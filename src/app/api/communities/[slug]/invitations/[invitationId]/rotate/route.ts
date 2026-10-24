import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../../lib/auth';
import { rotateInvitationKey } from '../../../../../../../lib/community/invitations';
import { inviteErrorResponse } from '../../../../../../../lib/community/inviteHttp';

export const dynamic = 'force-dynamic';

/** POST — new access key for the same link; the old key stops working at once. */
export async function POST(request: NextRequest, { params }: { params: { slug: string; invitationId: string } }) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const result = await rotateInvitationKey(user.id, params.slug, params.invitationId);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return inviteErrorResponse(err, 'rotate invitation key');
  }
}
