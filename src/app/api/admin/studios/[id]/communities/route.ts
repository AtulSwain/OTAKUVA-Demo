import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioCommunityService } from '../../../../../../lib/engine/studio/studioCommunityService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id } = params;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await studioCommunityService.getStudioCommunities(id, authUser.id, {
      visibility: 'ALL',
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/[id]/communities:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch studio communities' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();

    if (body.communityId) {
      const linked = await studioCommunityService.linkCommunityToStudio(authUser.id, id, body.communityId);
      return NextResponse.json({ success: true, community: linked });
    }

    const created = await studioCommunityService.createStudioCommunity(authUser.id, id, body);
    return NextResponse.json({ success: true, community: created });
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/[id]/communities:', error);
    return NextResponse.json({ error: error.message || 'Failed to link/create studio community' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id } = params;
    const { searchParams } = new URL(req.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return NextResponse.json({ error: 'communityId parameter required' }, { status: 400 });
    }

    const result = await studioCommunityService.unlinkCommunityFromStudio(authUser.id, id, communityId);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/studios/[id]/communities:', error);
    return NextResponse.json({ error: error.message || 'Failed to unlink community' }, { status: 400 });
  }
}
