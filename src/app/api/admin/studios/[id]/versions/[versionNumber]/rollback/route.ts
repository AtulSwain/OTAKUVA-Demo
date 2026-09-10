import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../../../lib/roles';
import { studioCmsService } from '../../../../../../../../lib/engine/studio/studioCmsService';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; versionNumber: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. ADMIN role required for studio version rollback.' }, { status: 403 });
    }

    const { id, versionNumber } = params;
    const vNum = parseInt(versionNumber, 10);

    const result = await studioCmsService.rollbackToVersion(authUser.id, id, vNum);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/[id]/versions/[versionNumber]/rollback:', error);
    return NextResponse.json({ error: error.message || 'Failed to rollback version' }, { status: 400 });
  }
}
