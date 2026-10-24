import { NextRequest, NextResponse } from 'next/server';
import { providerMetrics, JIKAN_BASE_URL } from '../../../../lib/jikanService';
import { requireRole } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'DATA_EDITOR');
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    success: true,
    data: {
      provider: 'jikan_v4',
      baseUrl: JIKAN_BASE_URL,
      metrics: providerMetrics,
      rateLimitPolicy: {
        minIntervalMs: 800,
        safeRequestsPerSec: 2.5,
        exponentialBackoff: true,
      },
    },
  });
}
