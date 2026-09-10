import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { AdminDuplicateReviewEngine } from '@/lib/catalog/adminDuplicateReview';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/catalog/merge
 * Admin endpoint to execute a transactional safe merge of duplicate anime entities
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required for merging entities' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { sourceAnimeId, targetAnimeId, reason = 'Administrative catalog deduplication' } = body;

    if (!sourceAnimeId || !targetAnimeId) {
      return NextResponse.json({ error: 'sourceAnimeId and targetAnimeId are required' }, { status: 400 });
    }

    const mergeResult = await AdminDuplicateReviewEngine.executeMerge(
      sourceAnimeId,
      targetAnimeId,
      user.id,
      reason
    );

    return NextResponse.json({
      success: true,
      mergeResult,
    });
  } catch (error: any) {
    console.error('Catalog merge API error:', error);
    return NextResponse.json({ error: error?.message || 'Catalog merge failed' }, { status: 500 });
  }
}
