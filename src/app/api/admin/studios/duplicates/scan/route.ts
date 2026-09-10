import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { studioDeduplicationService } from '@/lib/engine/studio/studioDeduplicationService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized: Data Editor access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const minConfidence = parseFloat(searchParams.get('minConfidence') || '0.55');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const scanResults = await studioDeduplicationService.scanForDuplicates({ minConfidence, limit });
    return NextResponse.json({ success: true, ...scanResults });
  } catch (error) {
    console.error('Error scanning for studio duplicates:', error);
    return NextResponse.json({ error: 'Failed to scan for duplicates' }, { status: 500 });
  }
}
