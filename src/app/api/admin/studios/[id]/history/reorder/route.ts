import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../../lib/roles';
import { studioHistoryAdminService } from '../../../../../../../lib/engine/studio/studioHistoryAdminService';

export const dynamic = 'force-dynamic';

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
    const body = await req.json();
    const { orders } = body;

    if (!Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({ error: 'Orders array is required.' }, { status: 400 });
    }

    const result = await studioHistoryAdminService.reorderHistoryEvents(authUser.id, id, orders);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error reordering history events:', error);
    return NextResponse.json({ error: error.message || 'Failed to reorder history events' }, { status: 400 });
  }
}
