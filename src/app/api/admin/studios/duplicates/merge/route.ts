import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { studioDeduplicationService } from '@/lib/engine/studio/studioDeduplicationService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized: Data Editor access required' }, { status: 403 });
    }

    const body = await req.json();
    const { canonicalId, mergingId, reason, confidenceScore } = body;

    if (!canonicalId || !mergingId) {
      return NextResponse.json({ error: 'canonicalId and mergingId are required' }, { status: 400 });
    }

    const result = await studioDeduplicationService.executeSafeMerge({
      canonicalId,
      mergingId,
      actorId: user.id,
      reason,
      confidenceScore,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error executing studio merge:', error);
    return NextResponse.json({ error: error?.message || 'Failed to execute studio merge' }, { status: 500 });
  }
}
