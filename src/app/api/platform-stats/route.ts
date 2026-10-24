import { NextResponse } from 'next/server';
import { getPlatformStats } from '../../../lib/platformStats';
import { logger } from '../../../lib/logger';

/** GET /api/platform-stats — anime / creators / members / articles / reviews counts (cached 10 min). */
export async function GET() {
  try {
    return NextResponse.json(await getPlatformStats(), { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (error) {
    logger.error('Platform stats failed', { error, route: '/api/platform-stats', method: 'GET' });
    return NextResponse.json({ error: 'Could not load stats.' }, { status: 500 });
  }
}
