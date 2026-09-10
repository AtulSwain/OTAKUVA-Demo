import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { tasteEngine } from '@/lib/engine/taste/tasteEngine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/recommendations/backfill
 * Recomputes and updates taste profiles across users in background batches
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const result = await tasteEngine.backfillAllUserProfiles();

    return NextResponse.json({
      success: true,
      ...result,
      message: `Successfully backfilled taste profiles for ${result.processedCount} users.`,
    });
  } catch (error: any) {
    console.error('Recommendation backfill API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to backfill user taste profiles' },
      { status: 500 }
    );
  }
}
