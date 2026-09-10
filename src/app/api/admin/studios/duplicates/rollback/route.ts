import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { studioDeduplicationService } from '@/lib/engine/studio/studioDeduplicationService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required for rollback' }, { status: 403 });
    }

    const body = await req.json();
    const { mergeId } = body;

    if (!mergeId) {
      return NextResponse.json({ error: 'mergeId is required' }, { status: 400 });
    }

    const result = await studioDeduplicationService.rollbackStudioMerge(mergeId, user.id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error rolling back studio merge:', error);
    return NextResponse.json({ error: error?.message || 'Failed to roll back studio merge' }, { status: 500 });
  }
}
