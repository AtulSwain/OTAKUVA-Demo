import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { studioProductionHardeningService } from '@/lib/engine/studio/studioProductionHardeningService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const audit = await studioProductionHardeningService.performCompleteEcosystemAudit();
    return NextResponse.json({ success: true, audit });
  } catch (error) {
    console.error('Error performing ecosystem audit:', error);
    return NextResponse.json({ error: 'Failed to perform ecosystem audit' }, { status: 500 });
  }
}
