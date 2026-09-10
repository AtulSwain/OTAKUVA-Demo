/**
 * OTAKUVA Schedule Timezone & Day-Boundary Calculation Engine
 * 
 * Provides robust IANA timezone normalization, DST-aware day boundaries,
 * midnight-boundary conversions, and local schedule formatting.
 */

export interface TimezoneDayBounds {
  startUtc: Date;
  endUtc: Date;
  localDateStr: string; // "YYYY-MM-DD"
  weekday: string;     // "Monday", "Tuesday", etc.
  timezone: string;
}

export interface FormattedScheduleItem {
  airingAtUtc: string;
  localDate: string;        // "2026-09-05"
  localTime: string;        // "17:30"
  localTime12h: string;     // "5:30 PM"
  weekday: string;          // "Saturday"
  targetTimezone: string;
  originalTimezone: string | null;
  originalTime: string | null;
  timeUntilAiringMs: number;
  timeUntilAiringSec: number;
  relativeTimeText: string;
  airingStatus: 'UPCOMING' | 'AIRING' | 'RELEASED' | 'DELAYED' | 'CANCELLED' | 'HIATUS';
}

export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
  group: string;
}

export const COMMON_TIMEZONES: TimezoneOption[] = [
  { value: 'Asia/Tokyo', label: 'Tokyo (JST, UTC+9)', offset: '+09:00', group: 'Asia & Pacific' },
  { value: 'Asia/Seoul', label: 'Seoul (KST, UTC+9)', offset: '+09:00', group: 'Asia & Pacific' },
  { value: 'Asia/Shanghai', label: 'Shanghai / Beijing (CST, UTC+8)', offset: '+08:00', group: 'Asia & Pacific' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT, UTC+8)', offset: '+08:00', group: 'Asia & Pacific' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT, UTC+8)', offset: '+08:00', group: 'Asia & Pacific' },
  { value: 'Asia/Kolkata', label: 'India (IST, UTC+5:30)', offset: '+05:30', group: 'Asia & Pacific' },
  { value: 'Asia/Bangkok', label: 'Bangkok / Jakarta (ICT, UTC+7)', offset: '+07:00', group: 'Asia & Pacific' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)', offset: '+10:00', group: 'Asia & Pacific' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)', offset: '+10:00', group: 'Asia & Pacific' },
  { value: 'Europe/London', label: 'London (GMT/BST)', offset: '+00:00', group: 'Europe' },
  { value: 'Europe/Paris', label: 'Paris / Berlin / Rome (CET/CEST)', offset: '+01:00', group: 'Europe' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)', offset: '+01:00', group: 'Europe' },
  { value: 'Europe/Athens', label: 'Athens / Helsinki (EET/EEST)', offset: '+02:00', group: 'Europe' },
  { value: 'America/New_York', label: 'New York (EST/EDT, UTC-5/-4)', offset: '-05:00', group: 'Americas' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT, UTC-6/-5)', offset: '-06:00', group: 'Americas' },
  { value: 'America/Denver', label: 'Denver (MST/MDT, UTC-7/-6)', offset: '-07:00', group: 'Americas' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT, UTC-8/-7)', offset: '-08:00', group: 'Americas' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT, UTC-3)', offset: '-03:00', group: 'Americas' },
  { value: 'America/Toronto', label: 'Toronto (EST/EDT)', offset: '-05:00', group: 'Americas' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)', offset: '+00:00', group: 'Universal' },
];

/**
 * Validates whether a timezone string is a recognized IANA identifier.
 * Returns the normalized timezone string or 'UTC' if invalid.
 */
export function validateTimezone(tz?: string | null): string {
  if (!tz || typeof tz !== 'string' || !tz.trim()) {
    return 'UTC';
  }
  const cleanTz = tz.trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: cleanTz }).format();
    return cleanTz;
  } catch {
    return 'UTC';
  }
}

/**
 * Extracts zoned date components for a given UTC timestamp.
 */
export function getZonedDateParts(date: Date, timezone: string): {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number;// 0-59
  second: number;// 0-59
  weekday: string; // "Monday", etc.
  dayKey: string;  // "YYYY-MM-DD"
} {
  const safeTz = validateTimezone(timezone);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  const year = parseInt(map.year, 10) || date.getUTCFullYear();
  const month = parseInt(map.month, 10) || (date.getUTCMonth() + 1);
  const day = parseInt(map.day, 10) || date.getUTCDate();
  const hour = parseInt(map.hour, 10) || 0;
  const minute = parseInt(map.minute, 10) || 0;
  const second = parseInt(map.second, 10) || 0;
  const weekday = map.weekday || 'Monday';
  const dayKey = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

  return { year, month, day, hour, minute, second, weekday, dayKey };
}

/**
 * Calculates the exact UTC start and end bounds of a given day in the specified target timezone.
 * Handles daylight saving transitions and midnight boundary offsets accurately.
 */
export function getTimezoneDayBounds(
  dateOrPreset: 'today' | 'tomorrow' | 'yesterday' | 'this_week' | string,
  timezone: string,
  referenceDate: Date = new Date()
): TimezoneDayBounds {
  const safeTz = validateTimezone(timezone);
  const now = referenceDate;
  const nowParts = getZonedDateParts(now, safeTz);

  let targetYear = nowParts.year;
  let targetMonth = nowParts.month;
  let targetDay = nowParts.day;

  const normalized = (dateOrPreset || 'today').toLowerCase().trim();

  if (normalized === 'today') {
    // Current day in target timezone
  } else if (normalized === 'tomorrow') {
    // Advance 1 day from reference date in target timezone
    const nextDayRef = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextParts = getZonedDateParts(nextDayRef, safeTz);
    targetYear = nextParts.year;
    targetMonth = nextParts.month;
    targetDay = nextParts.day;
  } else if (normalized === 'yesterday') {
    const prevDayRef = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const prevParts = getZonedDateParts(prevDayRef, safeTz);
    targetYear = prevParts.year;
    targetMonth = prevParts.month;
    targetDay = prevParts.day;
  } else if (normalized === 'this_week') {
    // For 'this_week', bounds represent the full 7-day rolling window starting from today 00:00 in user timezone
    const startBounds = getTimezoneDayBounds('today', safeTz, now);
    const endSevenDaysRef = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const endBounds = getTimezoneDayBounds('today', safeTz, endSevenDaysRef);
    return {
      startUtc: startBounds.startUtc,
      endUtc: endBounds.endUtc,
      localDateStr: startBounds.localDateStr,
      weekday: startBounds.weekday,
      timezone: safeTz,
    };
  } else {
    // Check if ISO or YYYY-MM-DD
    const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      targetYear = parseInt(match[1], 10);
      targetMonth = parseInt(match[2], 10);
      targetDay = parseInt(match[3], 10);
    }
  }

  // Construct target local dates and convert to UTC
  const localDateStr = `${targetYear.toString().padStart(4, '0')}-${targetMonth.toString().padStart(2, '0')}-${targetDay.toString().padStart(2, '0')}`;

  // Find UTC timestamp matching targetYear-targetMonth-targetDay 00:00:00.000 in safeTz
  const startUtc = findUtcForZonedTime(targetYear, targetMonth, targetDay, 0, 0, 0, safeTz);
  const endUtc = new Date(findUtcForZonedTime(targetYear, targetMonth, targetDay, 23, 59, 59, safeTz).getTime() + 999);

  const startParts = getZonedDateParts(startUtc, safeTz);

  return {
    startUtc,
    endUtc,
    localDateStr,
    weekday: startParts.weekday,
    timezone: safeTz,
  };
}

/**
 * Accurately finds the UTC Date corresponding to a given year, month, day, hour, minute, second in a specific timezone.
 */
export function findUtcForZonedTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timezone: string
): Date {
  // Approximate as UTC first
  const approxUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  let candidate = new Date(approxUtc);

  // Iteratively adjust for timezone offset
  for (let i = 0; i < 3; i++) {
    const parts = getZonedDateParts(candidate, timezone);
    const candidateAsLocal = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
    const desiredLocal = approxUtc;
    const diff = desiredLocal - candidateAsLocal;
    if (diff === 0) break;
    candidate = new Date(candidate.getTime() + diff);
  }

  return candidate;
}

/**
 * Calculates time remaining until airing or elapsed time with human readable text.
 */
export function calculateCountdown(airingAt: Date, now: Date = new Date()): {
  timeUntilAiringMs: number;
  timeUntilAiringSec: number;
  isAiringNow: boolean;
  isAired: boolean;
  relativeText: string;
} {
  const diffMs = airingAt.getTime() - now.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const absDiffSec = Math.abs(diffSec);

  // Episode is considered "AIRING" during a 30-minute window starting at release time
  const isAiringNow = diffMs <= 0 && diffMs >= -30 * 60 * 1000;
  const isAired = diffMs < -30 * 60 * 1000;

  let relativeText = '';

  if (isAiringNow) {
    relativeText = 'Airing now';
  } else if (diffMs > 0) {
    const hours = Math.floor(absDiffSec / 3600);
    const mins = Math.floor((absDiffSec % 3600) / 60);
    const days = Math.floor(hours / 24);

    if (days > 1) {
      relativeText = `in ${days} days`;
    } else if (days === 1) {
      relativeText = `in 1 day, ${hours % 24}h`;
    } else if (hours > 0) {
      relativeText = `in ${hours}h ${mins}m`;
    } else if (mins > 0) {
      relativeText = `in ${mins} mins`;
    } else {
      relativeText = 'in less than a minute';
    }
  } else {
    const hours = Math.floor(absDiffSec / 3600);
    const mins = Math.floor((absDiffSec % 3600) / 60);
    const days = Math.floor(hours / 24);

    if (days > 1) {
      relativeText = `${days} days ago`;
    } else if (days === 1) {
      relativeText = `yesterday`;
    } else if (hours > 0) {
      relativeText = `${hours}h ago`;
    } else if (mins > 0) {
      relativeText = `${mins}m ago`;
    } else {
      relativeText = 'just now';
    }
  }

  return {
    timeUntilAiringMs: diffMs,
    timeUntilAiringSec: diffSec,
    isAiringNow,
    isAired,
    relativeText,
  };
}

/**
 * Formats a release schedule item for a target timezone.
 */
export function formatToLocalSchedule(
  airingAtUtc: Date,
  originalTimezone: string | null = 'Asia/Tokyo',
  targetTimezone: string = 'UTC',
  scheduleStatus: string = 'UPCOMING',
  referenceDate: Date = new Date()
): FormattedScheduleItem {
  const safeTargetTz = validateTimezone(targetTimezone);
  const targetParts = getZonedDateParts(airingAtUtc, safeTargetTz);

  const localTime = `${targetParts.hour.toString().padStart(2, '0')}:${targetParts.minute.toString().padStart(2, '0')}`;
  
  const hour12 = targetParts.hour % 12 || 12;
  const ampm = targetParts.hour >= 12 ? 'PM' : 'AM';
  const localTime12h = `${hour12}:${targetParts.minute.toString().padStart(2, '0')} ${ampm}`;

  let originalTime: string | null = null;
  if (originalTimezone) {
    const safeOrigTz = validateTimezone(originalTimezone);
    const origParts = getZonedDateParts(airingAtUtc, safeOrigTz);
    originalTime = `${origParts.hour.toString().padStart(2, '0')}:${origParts.minute.toString().padStart(2, '0')} (${safeOrigTz.split('/').pop() || safeOrigTz})`;
  }

  const countdown = calculateCountdown(airingAtUtc, referenceDate);

  let derivedStatus: 'UPCOMING' | 'AIRING' | 'RELEASED' | 'DELAYED' | 'CANCELLED' | 'HIATUS' = 'UPCOMING';
  const upperStatus = (scheduleStatus || 'UPCOMING').toUpperCase();

  if (upperStatus === 'DELAYED') {
    derivedStatus = 'DELAYED';
  } else if (upperStatus === 'CANCELLED') {
    derivedStatus = 'CANCELLED';
  } else if (upperStatus === 'HIATUS') {
    derivedStatus = 'HIATUS';
  } else if (countdown.isAiringNow) {
    derivedStatus = 'AIRING';
  } else if (countdown.isAired) {
    derivedStatus = 'RELEASED';
  } else {
    derivedStatus = 'UPCOMING';
  }

  return {
    airingAtUtc: airingAtUtc.toISOString(),
    localDate: targetParts.dayKey,
    localTime,
    localTime12h,
    weekday: targetParts.weekday,
    targetTimezone: safeTargetTz,
    originalTimezone,
    originalTime,
    timeUntilAiringMs: countdown.timeUntilAiringMs,
    timeUntilAiringSec: countdown.timeUntilAiringSec,
    relativeTimeText: countdown.relativeText,
    airingStatus: derivedStatus,
  };
}

/**
 * Returns a 7-day array of day descriptors starting from today in the given timezone.
 */
export function getUpcomingWeekDays(timezone: string, referenceDate: Date = new Date()): Array<{
  dateStr: string;
  weekday: string;
  shortWeekday: string;
  isToday: boolean;
  isTomorrow: boolean;
}> {
  const safeTz = validateTimezone(timezone);
  const days: Array<{
    dateStr: string;
    weekday: string;
    shortWeekday: string;
    isToday: boolean;
    isTomorrow: boolean;
  }> = [];

  for (let i = 0; i < 7; i++) {
    const currentRef = new Date(referenceDate.getTime() + i * 24 * 60 * 60 * 1000);
    const bounds = getTimezoneDayBounds('today', safeTz, currentRef);
    days.push({
      dateStr: bounds.localDateStr,
      weekday: bounds.weekday,
      shortWeekday: bounds.weekday.substring(0, 3),
      isToday: i === 0,
      isTomorrow: i === 1,
    });
  }

  return days;
}

/**
 * Combines a specific calendar date with a local time-of-day in a given
 * timezone — used for one-time events (a premiere date) as opposed to
 * `getNextWeeklyOccurrenceUtc`'s recurring weekly slot.
 *
 * `date` is expected to carry the intended calendar date in its UTC
 * fields, which is what you get from `new Date("YYYY-MM-DD")` (a
 * date-only string parses as UTC midnight) — exactly the shape
 * provider-sourced "announced from" dates normalize to here.
 */
export function combineDateWithZonedTime(date: Date, hour: number, minute: number, timezone: string): Date {
  const safeTz = validateTimezone(timezone);
  return findUtcForZonedTime(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour, minute, 0, safeTz);
}

const WEEKDAY_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Given a recurring weekly broadcast slot (e.g. Jikan's `broadcast.day` /
 * `broadcast.time`, which come back as "Sundays" + "23:15" in the show's
 * original timezone — almost always Asia/Tokyo), finds the next real-world
 * UTC instant that slot falls on, strictly after `referenceDate`. DST-safe
 * via `findUtcForZonedTime`.
 *
 * `weekday` accepts both singular and plural ("Sunday" or "Sundays").
 * Returns null for unparseable input rather than guessing.
 */
export function getNextWeeklyOccurrenceUtc(
  weekday: string,
  hour: number,
  minute: number,
  timezone: string,
  referenceDate: Date = new Date()
): Date | null {
  if (!weekday || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  const safeTz = validateTimezone(timezone);
  const normalizedTarget = weekday.trim().toLowerCase().replace(/s$/, '');
  const targetIdx = WEEKDAY_ORDER.indexOf(normalizedTarget);
  if (targetIdx === -1) return null;

  const nowParts = getZonedDateParts(referenceDate, safeTz);
  const currentIdx = WEEKDAY_ORDER.indexOf(nowParts.weekday.toLowerCase());
  const daysAhead = (targetIdx - currentIdx + 7) % 7;

  // Advance today's zoned calendar date by daysAhead using UTC-arithmetic on
  // the *date fields only* (not the instant) — Date.UTC correctly normalizes
  // day overflow (e.g. day 32 rolls into next month), and this deliberately
  // ignores time-of-day so DST transitions between now and the target day
  // can't shift which calendar date we land on.
  const targetCalendarDate = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day + daysAhead));

  let result = findUtcForZonedTime(
    targetCalendarDate.getUTCFullYear(),
    targetCalendarDate.getUTCMonth() + 1,
    targetCalendarDate.getUTCDate(),
    hour,
    minute,
    0,
    safeTz
  );

  // Today is the target weekday, but that time already passed — the next
  // occurrence is a full week later, not today.
  if (result.getTime() <= referenceDate.getTime()) {
    result = findUtcForZonedTime(
      targetCalendarDate.getUTCFullYear(),
      targetCalendarDate.getUTCMonth() + 1,
      targetCalendarDate.getUTCDate() + 7,
      hour,
      minute,
      0,
      safeTz
    );
  }

  return result;
}
