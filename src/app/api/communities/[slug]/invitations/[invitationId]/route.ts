import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { revokeInvitation } from '../../../../../../lib/community/invitations';
import { inviteErrorResponse } from '../../../../../../lib/community/inviteHttp';

export const dynamic = 'force-dynamic';

/** DELETE — revoke: the link + key stop working at once. Existing members stay. */
export async function DELETE(request: NextRequest, { params }: { params: { slug: string; invitationId: string } }) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const invitation = await revokeInvitation(user.id, params.slug, params.invitationId);
    return NextResponse.json({ invitation }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return inviteErrorResponse(err, 'revoke invitation');
  }
}
