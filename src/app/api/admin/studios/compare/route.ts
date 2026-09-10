import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { hasMinRole } from '../../../../../lib/roles';
import { studioDashboardService } from '../../../../../lib/engine/studio/studioDashboardService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const studioA = searchParams.get('studioA') || searchParams.get('studioAId');
    const studioB = searchParams.get('studioB') || searchParams.get('studioBId');

    if (!studioA || !studioB) {
      return NextResponse.json(
        { error: 'studioA and studioB parameters are required for comparison' },
        { status: 400 }
      );
    }

    const comparison = await studioDashboardService.compareStudios(studioA, studioB);
    if (!comparison) {
      return NextResponse.json({ error: 'One or both studios could not be found' }, { status: 404 });
    }

    return NextResponse.json({ comparison });
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/compare:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compare studios' },
      { status: 500 }
    );
  }
}
