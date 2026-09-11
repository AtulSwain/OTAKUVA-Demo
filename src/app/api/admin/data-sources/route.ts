import { NextRequest, NextResponse } from 'next/server';
import { providerMetrics } from '../../../../lib/jikanService';
import { requireRole } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'DATA_EDITOR');
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    success: true,
    data: {
      provider: 'jikan_v4',
      baseUrl: process.env.JIKAN_BASE_URL || 'https://api.jikan.moe/v4',
      metrics: providerMetrics,
      rateLimitPolicy: {
        minIntervalMs: 800,
        safeRequestsPerSec: 2.5,
        exponentialBackoff: true,
      },
    },
  });
}
