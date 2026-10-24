import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser } from '../../../../../lib/auth';
import { redeemInvitation } from '../../../../../lib/community/invitations';
import { inviteErrorResponse } from '../../../../../lib/community/inviteHttp';

export const dynamic = 'force-dynamic';

/** POST /api/invite/:id/join { key } — join a members-only community. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireVerifiedUser(request);
    if (user instanceof NextResponse) return user;
    const body = await request.json().catch(() => ({}));
    const result = await redeemInvitation(user.id, params.id, body?.key);
    return NextResponse.json({ success: true, ...result }, { status: result.joined ? 201 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return inviteErrorResponse(err, 'join with invitation');
  }
}
