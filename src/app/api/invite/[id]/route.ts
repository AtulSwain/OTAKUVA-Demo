import { NextRequest, NextResponse } from 'next/server';
import { getInvitationPreview } from '../../../../lib/community/invitations';
import { inviteErrorResponse } from '../../../../lib/community/inviteHttp';

export const dynamic = 'force-dynamic';

/**
 * GET /api/invite/:id — what the invitation page may show before the key:
 * active or not, and (only when active) the community's name and icon.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await getInvitationPreview(params.id), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return inviteErrorResponse(err, 'load invitation');
  }
}
