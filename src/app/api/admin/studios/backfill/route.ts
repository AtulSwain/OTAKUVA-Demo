import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { hasMinRole } from '../../../../../lib/roles';
import { runStudioBackfill } from '../../../../../lib/engine/studio/studioBackfill';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. Running backfill requires ADMIN or SUPER_ADMIN role.' }, { status: 403 });
    }

    const summary = await runStudioBackfill();
    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    console.error('Error running studio backfill:', error);
    return NextResponse.json({ error: error.message || 'Failed to run backfill' }, { status: 500 });
  }
}
