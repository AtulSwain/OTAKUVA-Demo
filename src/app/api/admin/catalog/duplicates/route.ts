import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { AdminDuplicateReviewEngine } from '@/lib/catalog/adminDuplicateReview';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/catalog/duplicates
 * Admin endpoint returning pending duplicate candidate review queue
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized: Data Editor or Admin access required' }, { status: 403 });
    }

    const candidates = AdminDuplicateReviewEngine.getPendingCandidates();
    return NextResponse.json({
      success: true,
      count: candidates.length,
      candidates,
    });
  } catch (error: any) {
    console.error('Catalog duplicates API error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch duplicate review queue' }, { status: 500 });
  }
}
