import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { hasMinRole } from '../../../../../lib/roles';
import { studioAdminService } from '../../../../../lib/engine/studio/studioAdminService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. Studio merging requires ADMIN or SUPER_ADMIN role.' }, { status: 403 });
    }

    const body = await req.json();
    const { primaryStudioId, secondaryStudioId, reason, keepSecondaryAsAlias } = body;

    if (!primaryStudioId || !secondaryStudioId) {
      return NextResponse.json({ error: 'Both primaryStudioId and secondaryStudioId are required.' }, { status: 400 });
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ error: 'A valid audit reason is required for studio merge operations.' }, { status: 400 });
    }

    const result = await studioAdminService.mergeStudios(authUser.id, {
      primaryStudioId,
      secondaryStudioId,
      reason: reason.trim(),
      keepSecondaryAsAlias: keepSecondaryAsAlias ?? true,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Error merging studios:', error);
    return NextResponse.json({ error: error.message || 'Failed to merge studios' }, { status: 400 });
  }
}
