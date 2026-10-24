import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { removeCommunityMember } from '../../../../../../lib/community/memberAdmin';
import { inviteErrorResponse } from '../../../../../../lib/community/inviteHttp';

export const dynamic = 'force-dynamic';

/** DELETE /api/communities/:slug/members/:userId — owner/admin removes a member. */
export async function DELETE(request: NextRequest, { params }: { params: { slug: string; userId: string } }) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    return NextResponse.json(await removeCommunityMember(user.id, params.slug, params.userId));
  } catch (err) {
    return inviteErrorResponse(err, 'remove member');
  }
}
