import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioPeopleService } from '../../../../../../lib/engine/studio/studioPeopleService';

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

    const role = searchParams.get('role') || undefined;
    const q = searchParams.get('q') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await studioPeopleService.getStudioPeople(id, {
      role,
      q,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/[id]/people:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch studio people' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized. DATA_EDITOR role required.' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();

    const linked = await studioPeopleService.linkPersonToStudio(authUser.id, id, body);
    return NextResponse.json({ success: true, relation: linked });
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/[id]/people:', error);
    return NextResponse.json({ error: error.message || 'Failed to link person to studio' }, { status: 400 });
  }
}
