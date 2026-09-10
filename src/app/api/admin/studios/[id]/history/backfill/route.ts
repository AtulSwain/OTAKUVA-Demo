import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../../lib/roles';
import { runStudioHistoryBackfill } from '../../../../../../../lib/engine/studio/studioHistoryBackfill';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const summary = await runStudioHistoryBackfill();
    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    console.error('Error running history backfill:', error);
    return NextResponse.json({ error: error.message || 'Failed to run history backfill' }, { status: 500 });
  }
}
