import { NextRequest } from 'next/server';
import { getAuthUserFromRequest } from '../../../lib/auth';
import { withApiHandler } from '../../../lib/api/apiHandler';
import { ScheduleEngine, ScheduleQueryParams } from '../../../lib/engine/schedule/scheduleEngine';
import { CacheManager } from '../../../lib/performance/cacheManager';
import { ensureFreshSchedule } from '../../../lib/engine/schedule/scheduleFreshness';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler('Schedule', async (request: NextRequest) => {
  // Background refresh when the stored schedule is stale (never blocks this request).
  ensureFreshSchedule();
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

  // ScheduleEngine.querySchedule annotates every row with the caller's own
  // watch progress/reminders whenever an authUserId is passed — so a
  // signed-in caller's result is always personalized, never just "the
  // public schedule." Only an anonymous request is safe to serve from the
  // shared public-catalog cache; signed-in requests always hit the engine
  // directly (their own per-request cost, not cached — schedule reads
  // aren't expensive enough per-user to warrant a getOrSetForUser tier
  // here, unlike anime-detail).
  if (authUser?.id) {
    return ScheduleEngine.querySchedule(queryParams, authUser.id);
  }

  const cacheKey = `schedule:public:${JSON.stringify(queryParams)}`;
  return CacheManager.getOrSetCatalog('schedule', cacheKey, () => ScheduleEngine.querySchedule(queryParams, null));
});
