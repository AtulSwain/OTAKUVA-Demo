import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { representationLearningEngine } from '@/lib/engine/ai/representationLearningEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/intelligence/user-representation
 * Returns multi-cluster user taste vector representation
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const url = new URL(req.url);
    const query = url.searchParams.get('sessionQuery');
    const sessionQueries = query ? [query] : [];

    const representation = await representationLearningEngine.learnUserRepresentation(
      authUser.id,
      sessionQueries
    );

    return NextResponse.json({
      success: true,
      representation,
    });
  } catch (error: any) {
    console.error('User representation API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to learn user representation' },
      { status: 500 }
    );
  }
}
