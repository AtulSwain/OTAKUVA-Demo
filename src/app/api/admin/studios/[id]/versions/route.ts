import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioCmsService } from '../../../../../../lib/engine/studio/studioCmsService';

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
    const versions = await studioCmsService.getStudioVersions(id);
    return NextResponse.json({ versions });
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/[id]/versions:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch studio versions' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json().catch(() => ({}));

    const version = await studioCmsService.createStudioVersion(
      authUser.id,
      id,
      body.changesSummary
    );

    return NextResponse.json({ success: true, version });
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/[id]/versions:', error);
    return NextResponse.json({ error: error.message || 'Failed to create studio version' }, { status: 400 });
  }
}
