import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { discoveryCoreService } from '@/lib/engine/discovery/discoveryCoreService';
import { homeFeedEngine } from '@/lib/engine/discovery/homeFeedEngine';
import { getUserTasteProfile } from '@/lib/engine/taste/tasteEngine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/discovery/debugger?userId=...
 * Admin Discovery Core & Multi-Surface Inspector
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized: Data Editor or Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId') || user.id;

    const [taste, feedSnapshot, discoveryHome] = await Promise.all([
      getUserTasteProfile(targetUserId),
      homeFeedEngine.generateHomeFeed(targetUserId, { forceRefresh: true }),
      discoveryCoreService.getRecommendations({
        userId: targetUserId,
        surface: 'HOME',
        limit: 10,
        forceRefresh: true,
      }),
    ]);

    return NextResponse.json({
      success: true,
      targetUserId,
      tasteProfile: taste,
      feedComposition: {
        moduleCount: feedSnapshot.modules.length,
        modules: feedSnapshot.modules.map((m) => ({
          type: m.type,
          title: m.title,
          priorityScore: m.priorityScore,
          itemCount: m.items.length,
        })),
      },
      discoveryCore: {
        totalEvaluated: discoveryHome.totalEvaluated,
        items: discoveryHome.items,
      },
    });
  } catch (error: any) {
    console.error('Discovery debugger API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to inspect discovery intelligence' },
      { status: 500 }
    );
  }
}
