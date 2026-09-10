import { NextResponse } from 'next/server';
import { HealthService } from '@/lib/reliability/healthService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/health
 * Fast Liveness Probe for Load Balancers & Kubernetes
 */
export async function GET() {
  const liveness = HealthService.getLiveness();
  return NextResponse.json(liveness, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
