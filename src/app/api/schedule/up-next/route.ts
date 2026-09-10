import { NextRequest } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { withApiHandler } from '../../../../lib/api/apiHandler';
import { ScheduleEngine } from '../../../../lib/engine/schedule/scheduleEngine';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler('ScheduleUpNext', async (request: NextRequest) => {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser) {
    return {
      data: [],
      total: 0,
      authenticated: false,
      message: 'Sign in to see your personalized Up Next schedule',
    };
  }

  const { searchParams } = new URL(request.url);
  const timezone = searchParams.get('timezone') || 'UTC';
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;

  const result = await ScheduleEngine.getUpNextSchedule(authUser.id, timezone, limit);
  return {
    ...result,
    authenticated: true,
  };
});
