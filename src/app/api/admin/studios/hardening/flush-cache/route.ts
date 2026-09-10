import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { studioProductionHardeningService } from '@/lib/engine/studio/studioProductionHardeningService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const studioId = body?.studioId;
    studioProductionHardeningService.flushAllStudioCaches(studioId);

    return NextResponse.json({
      success: true,
      message: studioId ? `Flushed cache for studio ${studioId}` : 'Flushed all studio ecosystem caches',
    });
  } catch (error) {
    console.error('Error flushing studio cache:', error);
    return NextResponse.json({ error: 'Failed to flush studio cache' }, { status: 500 });
  }
}
