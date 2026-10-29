import { NextRequest, NextResponse } from 'next/server';
import { requireControl } from '@control/lib/access';
import { getControlOverview } from '@control/lib/overview';
import { controlError, NO_STORE } from '@control/lib/http';

/** GET /api/control/overview — users, activity, catalog gaps, community and news counts. ADMIN+. */
export async function GET(request: NextRequest) {
  const auth = await requireControl(request);
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(await getControlOverview(), { headers: NO_STORE });
  } catch (e) {
    return controlError(e, '/api/control/overview');
  }
}
