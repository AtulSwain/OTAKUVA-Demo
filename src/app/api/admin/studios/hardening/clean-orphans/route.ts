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

    const result = await studioProductionHardeningService.cleanOrphanRelationships(user.id);
    return NextResponse.json({ success: true, cleanedCount: result.cleanedCount });
  } catch (error) {
    console.error('Error cleaning orphan relationships:', error);
    return NextResponse.json({ error: 'Failed to clean orphan relationships' }, { status: 500 });
  }
}
