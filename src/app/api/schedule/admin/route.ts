import { NextRequest } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { withApiHandler } from '../../../../lib/api/apiHandler';
import { hasMinRole } from '../../../../lib/roles';
import { ScheduleEngine } from '../../../../lib/engine/schedule/scheduleEngine';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler('ScheduleAdminReport', async (request: NextRequest) => {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
    return {
      success: false,
      error: 'FORBIDDEN',
      message: 'Admin or Data Editor role required',
    };
  }

  const report = await ScheduleEngine.getDataQualityReport();
  return {
    success: true,
    data: report,
  };
});

export const POST = withApiHandler('ScheduleAdminOverride', async (request: NextRequest) => {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
    return {
      success: false,
      error: 'FORBIDDEN',
      message: 'Admin or Data Editor role required',
    };
  }

  const body = await request.json().catch(() => ({}));

  if (!body.animeId || typeof body.episode !== 'number' || !body.airingAt) {
    return {
      success: false,
      error: 'INVALID_REQUEST',
      message: 'animeId, episode, and airingAt are required',
    };
  }

  const result = await ScheduleEngine.ingestScheduleEvent({
    animeId: body.animeId,
    episode: body.episode,
    airingAt: body.airingAt,
    seasonId: body.seasonId,
    episodeId: body.episodeId,
    originalAiringAt: body.originalAiringAt,
    originalTimezone: body.originalTimezone,
    releaseType: body.releaseType,
    scheduleStatus: body.scheduleStatus,
    delayReason: body.delayReason,
    notes: body.notes,
    region: body.region,
    isVerified: body.isVerified ?? true,
    sourceProvider: 'admin_override',
  });

  return {
    success: true,
    data: result,
    message: 'Schedule entry successfully updated',
  };
});
