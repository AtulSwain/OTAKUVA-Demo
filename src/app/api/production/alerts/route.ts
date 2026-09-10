import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { AlertManager } from '@/lib/production/alertManager';

export const dynamic = 'force-dynamic';

/**
 * GET /api/production/alerts
 * Protected endpoint returning active and historical operational alerts
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized: Data Editor or Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const unresolvedOnly = searchParams.get('unresolved') === 'true';
    const alerts = AlertManager.getAlerts({ unresolvedOnly });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: alerts.length,
      alerts,
    });
  } catch (error: any) {
    console.error('Production alerts API error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch alerts' }, { status: 500 });
  }
}
