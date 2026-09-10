import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioCmsService } from '../../../../../../lib/engine/studio/studioCmsService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. ADMIN role required for batch studio import execution.' }, { status: 403 });
    }

    const body = await req.json();
    const items = body.items || [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    const result = await studioCmsService.executeStudioImport(authUser.id, items);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/import/execute:', error);
    return NextResponse.json({ error: error.message || 'Failed to execute import' }, { status: 500 });
  }
}
