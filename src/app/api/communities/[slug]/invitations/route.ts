import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { createInvitation, listInvitations } from '../../../../../lib/community/invitations';
import { inviteErrorResponse } from '../../../../../lib/community/inviteHttp';

export const dynamic = 'force-dynamic';

/**
 * Members-only invitations, for the community's owner (or a platform admin).
 * GET  — list invitations (status, uses, key hint — never the key)
 * POST — new invitation { expiresAt?, maxUses? } → { invitation, key } (key shown once)
 */
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const invitations = await listInvitations(user.id, params.slug);
    return NextResponse.json({ invitations }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return inviteErrorResponse(err, 'list invitations');
  }
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const result = await createInvitation(user.id, params.slug, { expiresAt: body?.expiresAt, maxUses: body?.maxUses });
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return inviteErrorResponse(err, 'create invitation');
  }
}
