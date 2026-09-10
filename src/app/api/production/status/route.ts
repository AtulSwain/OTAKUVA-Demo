import { NextResponse } from 'next/server';
import { LaunchValidator } from '@/lib/production/launchValidator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/production/status
 * Public / LB endpoint returning production launch scorecard & Go/No-Go verdict
 */
export async function GET() {
  try {
    const scorecard = await LaunchValidator.evaluateLaunchReadiness();
    const statusCode = scorecard.decision === 'GO' ? 200 : 503;

    return NextResponse.json(scorecard, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        decision: 'NO-GO',
        error: error?.message || 'Failed to evaluate production status',
      },
      { status: 500 }
    );
  }
}
