import { NextRequest } from 'next/server';
import { getAuthUserFromRequest } from '../../../lib/auth';
import { withApiHandler } from '../../../lib/api/apiHandler';
import { ScheduleEngine, ScheduleQueryParams } from '../../../lib/engine/schedule/scheduleEngine';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler('Schedule', async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const authUser = await getAuthUserFromRequest(request);

  const queryParams: ScheduleQueryParams = {
    date: searchParams.get('date') || undefined,
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
    day: searchParams.get('day') || undefined,
    timezone: searchParams.get('timezone') || 'UTC',
    region: searchParams.get('region') || undefined,
    status: searchParams.get('status') || undefined,
    releaseType: searchParams.get('releaseType') || undefined,
    animeId: searchParams.get('animeId') || undefined,
    seasonId: searchParams.get('seasonId') || undefined,
    libraryOnly: searchParams.get('library') === 'true' || searchParams.get('libraryOnly') === 'true',
    sort: (searchParams.get('sort') as any) || undefined,
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50,
  };

  const result = await ScheduleEngine.querySchedule(queryParams, authUser?.id);
  return result;
});
