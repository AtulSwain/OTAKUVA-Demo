import { NextRequest } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { withApiHandler } from '../../../../lib/api/apiHandler';
import { ScheduleEngine } from '../../../../lib/engine/schedule/scheduleEngine';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler('ScheduleReminders', async (request: NextRequest) => {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser) {
    return {
      data: [],
      total: 0,
      authenticated: false,
    };
  }

  const { searchParams } = new URL(request.url);
  const timezone = searchParams.get('timezone') || 'UTC';

  const result = await ScheduleEngine.getUserReminders(authUser.id, timezone);
  return {
    ...result,
    authenticated: true,
  };
});

export const POST = withApiHandler('ToggleScheduleReminder', async (request: NextRequest) => {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser) {
    return {
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Authentication required to set schedule reminders',
    };
  }

  const body = await request.json().catch(() => ({}));
  const scheduleId = body.scheduleId;
  const remindBeforeMinutes = typeof body.remindBeforeMinutes === 'number' ? body.remindBeforeMinutes : 10;

  if (!scheduleId || typeof scheduleId !== 'string') {
    return {
      success: false,
      error: 'INVALID_REQUEST',
      message: 'scheduleId is required',
    };
  }

  const result = await ScheduleEngine.toggleReminder(authUser.id, scheduleId, remindBeforeMinutes);
  return {
    success: true,
    active: result.active,
    reminderId: result.reminderId,
    message: result.active ? 'Reminder set successfully' : 'Reminder removed',
  };
});
