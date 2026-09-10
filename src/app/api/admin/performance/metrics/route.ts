import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { PerformanceMetrics } from '@/lib/performance/performanceMetrics';
import { CacheManager } from '@/lib/performance/cacheManager';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/performance/metrics
 * Protected Admin Performance & Telemetry Dashboard
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized: Data Editor or Admin access required' }, { status: 403 });
    }

    const stats = PerformanceMetrics.getStats();
    const cache = CacheManager.getMetrics();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      performance: stats,
      cache,
    });
  } catch (error: any) {
    console.error('Admin performance metrics API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}
