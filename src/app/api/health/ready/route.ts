import { NextResponse } from 'next/server';
import { HealthService } from '@/lib/reliability/healthService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/health/ready
 * Deep Readiness Probe (Database, Cache, Memory)
 */
export async function GET() {
  const report = await HealthService.getReadiness();
  const statusCode = report.status === 'UNHEALTHY' ? 503 : 200;

  return NextResponse.json(report, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
