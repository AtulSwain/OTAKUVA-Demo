/**
 * OTAKUVA Canonical Anime Schedule Engine
 * 
 * Production-grade schedule query builder, timezone projection,
 * personalized "Up Next" generation, user reminders, zero N+1 batching,
 * and resilient provider synchronization.
 */

import { prisma } from '../../prisma';
import { getAnimeDisplayTitle } from '../../animeTitleResolver';
import { CacheManager } from '../../performance/cacheManager';
import { PaginationMeta } from '../../contracts/apiContracts';
import {
  validateTimezone,
  getTimezoneDayBounds,
  formatToLocalSchedule,
  getNextWeeklyOccurrenceUtc,
  combineDateWithZonedTime,
  FormattedScheduleItem,
} from './scheduleTimezone';

export interface ScheduleQueryParams {
  date?: string;             // 'today' | 'tomorrow' | 'yesterday' | 'this_week' | 'YYYY-MM-DD'
  from?: string;             // ISO date or YYYY-MM-DD
  to?: string;               // ISO date or YYYY-MM-DD
  day?: string;              // "Monday", "Tuesday", etc. (legacy fallback)
  timezone?: string;         // e.g. "Asia/Tokyo", "Europe/Paris", "America/New_York", "UTC"
  region?: string;           // "GLOBAL", "JP", "US", "EU", etc.
  status?: string;           // "UPCOMING", "AIRING", "RELEASED", "DELAYED", "CANCELLED", "ALL"
  releaseType?: string;      // "BROADCAST", "STREAMING", "SIMULCAST", "THEATRICAL", "DIGITAL", "ALL"
  animeId?: string;
  seasonId?: string;
  libraryOnly?: boolean;
  sort?: 'time_asc' | 'time_desc' | 'popularity' | 'title';
  page?: number;
  limit?: number;
}

export interface EnrichedScheduleItem extends FormattedScheduleItem {
  id: string;
  animeId: string;
  slug: string;
  title: string;
  canonicalTitle: string;
  romajiTitle: string | null;
  englishTitle: string | null;
  japaneseTitle: string | null;
  posterImage: string | null;
  bannerImage: string | null;
  format: string;
  score: number | null;
  popularity: number | null;
  genres: string[];
  
  // Episode Details
  episode: number;
  episodeId: string | null;
  episodeTitle: string | null;
  episodeAiredAt: string | null;
  isFiller: boolean;
  isRecap: boolean;
  
  // Season Details
  seasonId: string | null;
  seasonTitle: string | null;
  seasonNumber: number | null;

  // Release Info
  releaseType: string;
  region: string;
  isVerified: boolean;
  delayReason: string | null;
  notes: string | null;
  sourceProvider: string;

  // User Specific (null or defaults if unauthenticated)
  inLibrary: boolean;
  libraryStatus: string | null;
  userEpisodesWatched: number | null;
  hasWatchedEpisode: boolean;
  hasReminder: boolean;
  reminderStatus: string | null;

  // Backward compatibility
  day: string;
  timeUntilAiring: number | null;
  status: string;
}

export interface ScheduleQueryResult {
  data: EnrichedScheduleItem[];
  meta: PaginationMeta;
  timezone: string;
  dateRange: {
    from: string;
    to: string;
    localDateStr?: string;
  };
  // Backward compatibility fields
  schedule: EnrichedScheduleItem[];
  total: number;
  days: string[];
  libraryOnly: boolean;
}

export interface IngestScheduleEventInput {
  animeId: string;
  episode: number;
  airingAt: Date | string;
  seasonId?: string | null;
  episodeId?: string | null;
  originalAiringAt?: Date | string | null;
  originalTimezone?: string | null;
  timezone?: string | null;
  releaseType?: string;
  scheduleStatus?: string;
  delayReason?: string | null;
  notes?: string | null;
  region?: string;
  isVerified?: boolean;
  sourceProvider?: string;
  externalScheduleId?: string | null;
}

const SCHEDULE_CACHE_TTL_SEC = 60; // 1 minute cache for dynamic schedule feeds
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DAY_MS = 86_400_000;
// Episode airedAt values are often date-only, so "the same broadcast" is
// matched within a couple of days rather than to the minute.
const SAME_BROADCAST_DAYS = 2;
// A weekly show's previous episode aired about 7 days before the next slot;
// the window tolerates one skipped week.
const PREVIOUS_SLOT_MIN_DAYS = 4;
const PREVIOUS_SLOT_MAX_DAYS = 15;

/**
 * Which episode airs in a weekly slot at `slotAt`, or null when the recorded
 * episodes can't tell us. Uses only canonical Episode rows:
 *  - an episode already recorded for that date is that episode;
 *  - otherwise, if the highest-numbered episode on record aired in the
 *    previous slot, the next one follows it.
 * Anything else — an import that stopped years ago, no aired dates, a gap —
 * returns null. Callers must skip rather than guess.
 */
export async function inferNextEpisodeNumber(animeId: string, slotAt: Date): Promise<number | null> {
  const windowStart = new Date(slotAt.getTime() - SAME_BROADCAST_DAYS * DAY_MS);
  const windowEnd = new Date(slotAt.getTime() + SAME_BROADCAST_DAYS * DAY_MS);

  const [recordedForSlot, highest, latestAired] = await Promise.all([
    prisma.episode.findFirst({
      where: { animeId, airedAt: { gte: windowStart, lte: windowEnd } },
      orderBy: { number: 'asc' },
      select: { number: true },
    }),
    prisma.episode.findFirst({ where: { animeId }, orderBy: { number: 'desc' }, select: { number: true } }),
    prisma.episode.findFirst({
      where: { animeId, airedAt: { not: null, lt: windowStart } },
      orderBy: { airedAt: 'desc' },
      select: { number: true, airedAt: true },
    }),
  ]);

  if (recordedForSlot && Number.isInteger(recordedForSlot.number)) return recordedForSlot.number;
  if (!highest || !latestAired?.airedAt || latestAired.number !== highest.number) return null;

  const gapDays = (slotAt.getTime() - latestAired.airedAt.getTime()) / DAY_MS;
  if (gapDays < PREVIOUS_SLOT_MIN_DAYS || gapDays > PREVIOUS_SLOT_MAX_DAYS) return null;

  return Math.floor(highest.number) + 1;
}

/**
 * Whether a schedule row's episode number is supported by canonical data:
 * the inference above agrees with it, or it is a premiere that lines up with
 * the anime's recorded start date.
 */
export async function isScheduledEpisodeSupported(
  animeId: string,
  episode: number,
  airingAt: Date,
  airedFrom: Date | null
): Promise<boolean> {
  if (episode === 1 && airedFrom) {
    if (Math.abs(airingAt.getTime() - airedFrom.getTime()) <= SAME_BROADCAST_DAYS * DAY_MS) return true;
  }
  return (await inferNextEpisodeNumber(animeId, airingAt)) === episode;
}

export class ScheduleEngine {
  /**
   * Main query method for the anime airing schedule.
   * Performs zero N+1 lookups, batched user state injection, and timezone translation.
   */
  public static async querySchedule(
    params: ScheduleQueryParams,
    authUserId?: string | null,
    referenceDate: Date = new Date()
  ): Promise<ScheduleQueryResult> {
    const timezone = validateTimezone(params.timezone);
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(params.limit) || 50));
    const skip = (page - 1) * limit;

    // 1. Determine UTC Query Date Window
    let startUtc: Date;
    let endUtc: Date;
    let localDateStr: string | undefined;

    if (params.from && params.to) {
      startUtc = new Date(params.from);
      endUtc = new Date(params.to);
    } else if (params.date) {
      const bounds = getTimezoneDayBounds(params.date, timezone, referenceDate);
      startUtc = bounds.startUtc;
      endUtc = bounds.endUtc;
      localDateStr = bounds.localDateStr;
    } else {
      // Default: 7-day rolling window from now
      const nowMs = referenceDate.getTime();
      startUtc = new Date(nowMs - 24 * 60 * 60 * 1000); // 24h past buffer to catch recently aired
      endUtc = new Date(nowMs + 7 * 24 * 60 * 60 * 1000); // 7 days ahead
    }

    // 2. Fetch User Library if libraryOnly requested or user authenticated
    let userLibraryMap = new Map<string, { status: string; episodesWatched: number }>();
    let userEpisodeProgressSet = new Set<string>();
    let userRemindersSet = new Set<string>();

    if (authUserId) {
      const userAnimeRecords = await prisma.userAnime.findMany({
        where: { userId: authUserId },
        select: { animeId: true, status: true, episodesWatched: true },
      });
      for (const ua of userAnimeRecords) {
        userLibraryMap.set(ua.animeId, { status: ua.status, episodesWatched: ua.episodesWatched });
      }
    }

    if (params.libraryOnly && (!authUserId || userLibraryMap.size === 0)) {
      return {
        data: [],
        schedule: [],
        total: 0,
        meta: { total: 0, page, limit, totalPages: 0, hasNextPage: false, hasPrevPage: false },
        timezone,
        dateRange: { from: startUtc.toISOString(), to: endUtc.toISOString(), localDateStr },
        days: DAYS_OF_WEEK,
        libraryOnly: true,
      };
    }

    // 3. Build Prisma Where Clause
    const where: any = {
      airingAt: {
        gte: startUtc,
        lte: endUtc,
      },
    };

    if (params.libraryOnly && authUserId) {
      where.animeId = { in: Array.from(userLibraryMap.keys()) };
    }

    if (params.animeId) {
      where.animeId = params.animeId;
    }

    if (params.seasonId) {
      where.seasonId = params.seasonId;
    }

    if (params.region && params.region !== 'ALL') {
      where.region = params.region;
    }

    if (params.releaseType && params.releaseType !== 'ALL') {
      where.releaseType = params.releaseType.toUpperCase();
    }

    if (params.status && params.status !== 'ALL') {
      where.scheduleStatus = params.status.toUpperCase();
    }

    // 4. Order By
    let orderBy: any = { airingAt: 'asc' };
    if (params.sort === 'time_desc') {
      orderBy = { airingAt: 'desc' };
    }

    // 5. Execute DB Query with required relations
    const [rawSchedules, totalCount] = await Promise.all([
      prisma.airingSchedule.findMany({
        where,
        include: {
          episodeRecord: true,
          season: true,
          anime: {
            include: {
              animeGenres: { include: { genre: true } },
              titles: true,
            },
          },
        },
        orderBy,
      }),
      prisma.airingSchedule.count({ where }),
    ]);

    // 6. Zero N+1 Batch Lookups for User Episode Progress & Reminders
    if (authUserId && rawSchedules.length > 0) {
      const scheduleIds = rawSchedules.map((s) => s.id);
      const episodeIds = rawSchedules.map((s) => s.episodeId).filter(Boolean) as string[];

      const [reminders, watchedEpisodes] = await Promise.all([
        prisma.scheduleReminder.findMany({
          where: { userId: authUserId, scheduleId: { in: scheduleIds }, status: { not: 'CANCELLED' } },
          select: { scheduleId: true },
        }),
        episodeIds.length > 0
          ? prisma.userEpisodeProgress.findMany({
              where: { userId: authUserId, episodeId: { in: episodeIds }, status: 'COMPLETED' },
              select: { episodeId: true },
            })
          : Promise.resolve([]),
      ]);

      for (const r of reminders) {
        userRemindersSet.add(r.scheduleId);
      }
      for (const we of watchedEpisodes) {
        userEpisodeProgressSet.add(we.episodeId);
      }
    }

    // 7. Enrich and Format Items into Target Timezone
    const formattedItems: EnrichedScheduleItem[] = rawSchedules.map((item) => {
      const anime = item.anime;
      const displayTitle = getAnimeDisplayTitle(anime);
      const romaji = anime.titles.find((t) => t.type === 'romaji')?.title || null;
      const english = anime.titles.find((t) => t.type === 'english')?.title || null;
      const japanese = anime.titles.find((t) => t.type === 'japanese')?.title || null;
      const genres = anime.animeGenres.map((ag) => ag.genre.name);

      const localFormat = formatToLocalSchedule(
        item.airingAt,
        item.originalTimezone || item.timezone || 'Asia/Tokyo',
        timezone,
        item.scheduleStatus,
        referenceDate
      );

      const userAnimeData = userLibraryMap.get(anime.id);
      const inLibrary = !!userAnimeData;
      const hasWatchedEpisode = item.episodeId ? userEpisodeProgressSet.has(item.episodeId) : (userAnimeData ? userAnimeData.episodesWatched >= item.episode : false);
      const hasReminder = userRemindersSet.has(item.id);

      return {
        ...localFormat,
        id: item.id,
        animeId: anime.id,
        slug: anime.slug,
        title: displayTitle,
        canonicalTitle: displayTitle,
        romajiTitle: romaji,
        englishTitle: english,
        japaneseTitle: japanese,
        posterImage: anime.posterUrl,
        bannerImage: anime.bannerUrl || anime.posterUrl,
        format: anime.type || 'TV',
        score: anime.score,
        popularity: anime.popularity,
        genres,

        // Episode
        episode: item.episode,
        episodeId: item.episodeId,
        episodeTitle: item.episodeRecord?.title || null,
        episodeAiredAt: item.episodeRecord?.airedAt ? item.episodeRecord.airedAt.toISOString() : null,
        isFiller: item.episodeRecord?.filler ?? false,
        isRecap: item.episodeRecord?.recap ?? false,

        // Season
        seasonId: item.seasonId,
        seasonTitle: item.season?.title || null,
        seasonNumber: item.season?.seasonNumber || null,

        // Release Info
        releaseType: item.releaseType,
        region: item.region || 'GLOBAL',
        isVerified: item.isVerified,
        delayReason: item.delayReason,
        notes: item.notes,
        sourceProvider: item.sourceProvider || item.source || 'anilist',

        // User
        inLibrary,
        libraryStatus: userAnimeData ? userAnimeData.status : null,
        userEpisodesWatched: userAnimeData ? userAnimeData.episodesWatched : null,
        hasWatchedEpisode,
        hasReminder,
        reminderStatus: hasReminder ? 'ACTIVE' : null,

        // Backward compatibility
        day: localFormat.weekday,
        timeUntilAiring: item.timeUntilAiring ?? localFormat.timeUntilAiringSec,
        status: localFormat.airingStatus,
      };
    });

    // 8. Apply Day Name Filter if specified (e.g. legacy ?day=Monday)
    let finalItems = formattedItems;
    if (params.day && params.day !== 'All') {
      finalItems = formattedItems.filter((i) => i.day.toLowerCase() === params.day!.toLowerCase());
    }

    // 9. Apply In-Memory Sorting if non-standard sort requested (e.g. popularity, title)
    if (params.sort === 'popularity') {
      finalItems.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    } else if (params.sort === 'title') {
      finalItems.sort((a, b) => a.title.localeCompare(b.title));
    }

    // 10. Pagination Slicing
    const paginatedItems = finalItems.slice(skip, skip + limit);
    const totalPages = Math.ceil(finalItems.length / limit);

    return {
      data: paginatedItems,
      schedule: paginatedItems,
      total: finalItems.length,
      meta: {
        total: finalItems.length,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      timezone,
      dateRange: {
        from: startUtc.toISOString(),
        to: endUtc.toISOString(),
        localDateStr,
      },
      days: DAYS_OF_WEEK,
      libraryOnly: !!params.libraryOnly,
    };
  }

  /**
   * Generates the personalized "Up Next" episode releases for an authenticated user.
   * Finds the next scheduled or upcoming episode for anime in user's WATCHING/PLAN_TO_WATCH library.
   */
  public static async getUpNextSchedule(
    authUserId: string,
    timezone: string = 'UTC',
    limit: number = 10,
    referenceDate: Date = new Date()
  ): Promise<{
    data: EnrichedScheduleItem[];
    total: number;
    timezone: string;
  }> {
    const safeTz = validateTimezone(timezone);

    // 1. Fetch User's active anime in library
    const userAnimeList = await prisma.userAnime.findMany({
      where: {
        userId: authUserId,
        status: { in: ['WATCHING', 'PLAN_TO_WATCH'] },
      },
      select: {
        animeId: true,
        status: true,
        episodesWatched: true,
      },
    });

    if (userAnimeList.length === 0) {
      return { data: [], total: 0, timezone: safeTz };
    }

    const animeIdMap = new Map(userAnimeList.map((ua) => [ua.animeId, ua]));
    const animeIds = Array.from(animeIdMap.keys());

    // 2. Fetch upcoming schedule events for these anime
    const upcomingSchedules = await prisma.airingSchedule.findMany({
      where: {
        animeId: { in: animeIds },
        airingAt: {
          gte: new Date(referenceDate.getTime() - 2 * 60 * 60 * 1000), // Catch events airing right now or soon
        },
      },
      include: {
        episodeRecord: true,
        season: true,
        anime: {
          include: {
            animeGenres: { include: { genre: true } },
            titles: true,
          },
        },
      },
      orderBy: { airingAt: 'asc' },
    });

    // Filter to find the immediate next episode for each anime
    const nextEpisodePerAnime = new Map<string, typeof upcomingSchedules[0]>();
    for (const schedule of upcomingSchedules) {
      const userStatus = animeIdMap.get(schedule.animeId);
      if (!userStatus) continue;

      // Only include if episode is ahead of user's current progress
      if (schedule.episode > userStatus.episodesWatched) {
        if (!nextEpisodePerAnime.has(schedule.animeId)) {
          nextEpisodePerAnime.set(schedule.animeId, schedule);
        }
      }
    }

    const selectedSchedules = Array.from(nextEpisodePerAnime.values()).slice(0, limit);

    // Batch fetch reminders for selected schedules
    const scheduleIds = selectedSchedules.map((s) => s.id);
    const userReminders = await prisma.scheduleReminder.findMany({
      where: { userId: authUserId, scheduleId: { in: scheduleIds }, status: { not: 'CANCELLED' } },
      select: { scheduleId: true },
    });
    const reminderSet = new Set(userReminders.map((r) => r.scheduleId));

    const formattedList: EnrichedScheduleItem[] = selectedSchedules.map((item) => {
      const anime = item.anime;
      const displayTitle = getAnimeDisplayTitle(anime);
      const localFormat = formatToLocalSchedule(
        item.airingAt,
        item.originalTimezone || item.timezone || 'Asia/Tokyo',
        safeTz,
        item.scheduleStatus,
        referenceDate
      );
      const userStatus = animeIdMap.get(anime.id);
      const hasReminder = reminderSet.has(item.id);

      return {
        ...localFormat,
        id: item.id,
        animeId: anime.id,
        slug: anime.slug,
        title: displayTitle,
        canonicalTitle: displayTitle,
        romajiTitle: anime.titles.find((t) => t.type === 'romaji')?.title || null,
        englishTitle: anime.titles.find((t) => t.type === 'english')?.title || null,
        japaneseTitle: anime.titles.find((t) => t.type === 'japanese')?.title || null,
        posterImage: anime.posterUrl,
        bannerImage: anime.bannerUrl || anime.posterUrl,
        format: anime.type || 'TV',
        score: anime.score,
        popularity: anime.popularity,
        genres: anime.animeGenres.map((ag) => ag.genre.name),

        episode: item.episode,
        episodeId: item.episodeId,
        episodeTitle: item.episodeRecord?.title || null,
        episodeAiredAt: item.episodeRecord?.airedAt ? item.episodeRecord.airedAt.toISOString() : null,
        isFiller: item.episodeRecord?.filler ?? false,
        isRecap: item.episodeRecord?.recap ?? false,

        seasonId: item.seasonId,
        seasonTitle: item.season?.title || null,
        seasonNumber: item.season?.seasonNumber || null,

        releaseType: item.releaseType,
        region: item.region || 'GLOBAL',
        isVerified: item.isVerified,
        delayReason: item.delayReason,
        notes: item.notes,
        sourceProvider: item.sourceProvider || item.source || 'anilist',

        inLibrary: true,
        libraryStatus: userStatus ? userStatus.status : null,
        userEpisodesWatched: userStatus ? userStatus.episodesWatched : null,
        hasWatchedEpisode: false,
        hasReminder,
        reminderStatus: hasReminder ? 'ACTIVE' : null,

        day: localFormat.weekday,
        timeUntilAiring: item.timeUntilAiring ?? localFormat.timeUntilAiringSec,
        status: localFormat.airingStatus,
      };
    });

    return {
      data: formattedList,
      total: formattedList.length,
      timezone: safeTz,
    };
  }

  /**
   * Ingests or updates a canonical schedule event with conflict resolution and delay detection.
   */
  public static async ingestScheduleEvent(event: IngestScheduleEventInput): Promise<any> {
    const airingAtDate = new Date(event.airingAt);
    const releaseType = (event.releaseType || 'BROADCAST').toUpperCase();

    // 1. Resolve canonical episode if episodeId is missing
    let resolvedEpisodeId = event.episodeId || null;
    let resolvedSeasonId = event.seasonId || null;

    if (!resolvedEpisodeId) {
      const canonicalEpisode = await prisma.episode.findUnique({
        where: {
          animeId_number: {
            animeId: event.animeId,
            number: event.episode,
          },
        },
        select: { id: true, seasonId: true },
      });

      if (canonicalEpisode) {
        resolvedEpisodeId = canonicalEpisode.id;
        if (!resolvedSeasonId && canonicalEpisode.seasonId) {
          resolvedSeasonId = canonicalEpisode.seasonId;
        }
      }
    }

    // 2. Check existing schedule entry to detect delay or modification
    const existing = await prisma.airingSchedule.findUnique({
      where: {
        animeId_episode_releaseType: {
          animeId: event.animeId,
          episode: event.episode,
          releaseType,
        },
      },
    });

    let originalAiringAt = event.originalAiringAt ? new Date(event.originalAiringAt) : existing?.originalAiringAt || null;
    let scheduleStatus = event.scheduleStatus || existing?.scheduleStatus || 'UPCOMING';
    let delayReason = event.delayReason || existing?.delayReason || null;

    if (existing) {
      const timeDiff = Math.abs(airingAtDate.getTime() - existing.airingAt.getTime());
      // If time changed by more than 1 hour and was pushed back
      if (timeDiff > 60 * 60 * 1000 && airingAtDate.getTime() > existing.airingAt.getTime()) {
        if (!originalAiringAt) {
          originalAiringAt = existing.airingAt;
        }
        if (!event.scheduleStatus) {
          scheduleStatus = 'DELAYED';
        }
      }
    }

    // 3. Upsert AiringSchedule Record
    const result = await prisma.airingSchedule.upsert({
      where: {
        animeId_episode_releaseType: {
          animeId: event.animeId,
          episode: event.episode,
          releaseType,
        },
      },
      create: {
        animeId: event.animeId,
        seasonId: resolvedSeasonId,
        episodeId: resolvedEpisodeId,
        episode: event.episode,
        airingAt: airingAtDate,
        originalAiringAt,
        originalTimezone: event.originalTimezone || 'Asia/Tokyo',
        releaseType,
        timezone: event.timezone || 'UTC',
        scheduleStatus,
        delayReason,
        notes: event.notes,
        region: event.region || 'GLOBAL',
        // Verified only when the caller has a source that confirms it.
        isVerified: event.isVerified ?? false,
        sourceProvider: event.sourceProvider || 'anilist',
        source: event.sourceProvider || 'anilist',
        externalScheduleId: event.externalScheduleId,
        lastVerifiedAt: new Date(),
      },
      update: {
        airingAt: airingAtDate,
        seasonId: resolvedSeasonId || undefined,
        episodeId: resolvedEpisodeId || undefined,
        originalAiringAt: originalAiringAt || undefined,
        originalTimezone: event.originalTimezone || undefined,
        scheduleStatus,
        delayReason,
        notes: event.notes || undefined,
        region: event.region || undefined,
        isVerified: event.isVerified ?? undefined,
        sourceProvider: event.sourceProvider || undefined,
        externalScheduleId: event.externalScheduleId || undefined,
        lastVerifiedAt: new Date(),
      },
    });

    return result;
  }

  /**
   * Toggles or creates a user reminder for an episode schedule event.
   */
  public static async toggleReminder(
    userId: string,
    scheduleId: string,
    remindBeforeMinutes: number = 10
  ): Promise<{ active: boolean; reminderId: string | null }> {
    const existing = await prisma.scheduleReminder.findUnique({
      where: {
        userId_scheduleId: {
          userId,
          scheduleId,
        },
      },
    });

    if (existing) {
      if (existing.status === 'CANCELLED') {
        // Reactivate
        const updated = await prisma.scheduleReminder.update({
          where: { id: existing.id },
          data: { status: 'PENDING', remindBeforeMinutes },
        });
        return { active: true, reminderId: updated.id };
      } else {
        // Toggle Off
        await prisma.scheduleReminder.update({
          where: { id: existing.id },
          data: { status: 'CANCELLED' },
        });
        return { active: false, reminderId: null };
      }
    }

    // Create new
    const created = await prisma.scheduleReminder.create({
      data: {
        userId,
        scheduleId,
        remindBeforeMinutes,
        status: 'PENDING',
      },
    });

    return { active: true, reminderId: created.id };
  }

  /**
   * Retrieves all active reminders for a user.
   */
  public static async getUserReminders(
    userId: string,
    timezone: string = 'UTC'
  ): Promise<{ data: EnrichedScheduleItem[]; total: number }> {
    const safeTz = validateTimezone(timezone);
    const reminders = await prisma.scheduleReminder.findMany({
      where: { userId, status: 'PENDING' },
      include: {
        schedule: {
          include: {
            episodeRecord: true,
            season: true,
            anime: {
              include: {
                animeGenres: { include: { genre: true } },
                titles: true,
              },
            },
          },
        },
      },
      orderBy: { schedule: { airingAt: 'asc' } },
    });

    const items: EnrichedScheduleItem[] = reminders.map((r) => {
      const item = r.schedule;
      const anime = item.anime;
      const displayTitle = getAnimeDisplayTitle(anime);
      const localFormat = formatToLocalSchedule(
        item.airingAt,
        item.originalTimezone || 'Asia/Tokyo',
        safeTz,
        item.scheduleStatus
      );

      return {
        ...localFormat,
        id: item.id,
        animeId: anime.id,
        slug: anime.slug,
        title: displayTitle,
        canonicalTitle: displayTitle,
        romajiTitle: anime.titles.find((t) => t.type === 'romaji')?.title || null,
        englishTitle: anime.titles.find((t) => t.type === 'english')?.title || null,
        japaneseTitle: anime.titles.find((t) => t.type === 'japanese')?.title || null,
        posterImage: anime.posterUrl,
        bannerImage: anime.bannerUrl || anime.posterUrl,
        format: anime.type || 'TV',
        score: anime.score,
        popularity: anime.popularity,
        genres: anime.animeGenres.map((ag) => ag.genre.name),

        episode: item.episode,
        episodeId: item.episodeId,
        episodeTitle: item.episodeRecord?.title || null,
        episodeAiredAt: item.episodeRecord?.airedAt ? item.episodeRecord.airedAt.toISOString() : null,
        isFiller: item.episodeRecord?.filler ?? false,
        isRecap: item.episodeRecord?.recap ?? false,

        seasonId: item.seasonId,
        seasonTitle: item.season?.title || null,
        seasonNumber: item.season?.seasonNumber || null,

        releaseType: item.releaseType,
        region: item.region || 'GLOBAL',
        isVerified: item.isVerified,
        delayReason: item.delayReason,
        notes: item.notes,
        sourceProvider: item.sourceProvider || item.source || 'anilist',

        inLibrary: true,
        libraryStatus: 'WATCHING',
        userEpisodesWatched: null,
        hasWatchedEpisode: false,
        hasReminder: true,
        reminderStatus: 'PENDING',

        day: localFormat.weekday,
        timeUntilAiring: item.timeUntilAiring ?? localFormat.timeUntilAiringSec,
        status: localFormat.airingStatus,
      };
    });

    return { data: items, total: items.length };
  }

  /**
   * Generates comprehensive Data Quality Audit report for anime schedules.
   */
  public static async getDataQualityReport(): Promise<{
    totalSchedules: number;
    linkedEpisodePercentage: number;
    linkedSeasonPercentage: number;
    delayedCount: number;
    cancelledCount: number;
    verifiedPercentage: number;
    multiChannelReleases: number;
    healthScore: number;
  }> {
    const [
      totalSchedules,
      linkedEpisodes,
      linkedSeasons,
      delayedCount,
      cancelledCount,
      verifiedCount,
    ] = await Promise.all([
      prisma.airingSchedule.count(),
      prisma.airingSchedule.count({ where: { episodeId: { not: null } } }),
      prisma.airingSchedule.count({ where: { seasonId: { not: null } } }),
      prisma.airingSchedule.count({ where: { scheduleStatus: 'DELAYED' } }),
      prisma.airingSchedule.count({ where: { scheduleStatus: 'CANCELLED' } }),
      prisma.airingSchedule.count({ where: { isVerified: true } }),
    ]);

    const linkedEpPct = totalSchedules > 0 ? (linkedEpisodes / totalSchedules) * 100 : 100;
    const linkedSeasonPct = totalSchedules > 0 ? (linkedSeasons / totalSchedules) * 100 : 100;
    const verifiedPct = totalSchedules > 0 ? (verifiedCount / totalSchedules) * 100 : 100;

    // Calculate overall health score (0-100)
    const healthScore = Math.round((linkedEpPct * 0.4) + (verifiedPct * 0.4) + (linkedSeasonPct * 0.2));

    return {
      totalSchedules,
      linkedEpisodePercentage: Math.round(linkedEpPct * 10) / 10,
      linkedSeasonPercentage: Math.round(linkedSeasonPct * 10) / 10,
      delayedCount,
      cancelledCount,
      verifiedPercentage: Math.round(verifiedPct * 10) / 10,
      multiChannelReleases: totalSchedules,
      healthScore,
    };
  }

  /**
   * Populates AiringSchedule from the real-world weekly broadcast slot
   * (`broadcastDay`/`broadcastTime`/`broadcastTimezone`) already stored on
   * each Anime record — Jikan sets these from MAL's actual TV broadcast
   * listing during catalog sync, so no extra provider calls are needed
   * here at all.
   *
   * This is deliberately narrower than `SyncEngine.syncWeeklySchedule`
   * (which pulls AniList's `airingSchedule` for precise per-episode
   * timestamps): it only computes "the next occurrence of this show's
   * recurring weekly slot," which is exactly what a real TV broadcast is,
   * but can't reflect one-off delays/preemptions the way a provider's live
   * schedule feed can. The two are complementary, not a replacement for
   * each other — this covers every Jikan-sourced airing show (the bulk of
   * the catalog); syncWeeklySchedule covers whatever AniList also knows.
   *
   * Only ever touches anime whose status is exactly "Currently Airing" —
   * never guesses a next episode for a finished, upcoming, or cancelled
   * show. Never runs past a show's own stated total episode count either.
   */
  public static async syncFromBroadcastMetadata(referenceDate: Date = new Date()): Promise<{
    processed: number;
    created: number;
    updated: number;
    skipped: number;
  }> {
    const airingAnime = await prisma.anime.findMany({
      where: {
        status: 'Currently Airing',
        broadcastDay: { not: null },
        broadcastTime: { not: null },
      },
      select: { id: true, broadcastDay: true, broadcastTime: true, broadcastTimezone: true, episodes: true },
    });

    let processed = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const anime of airingAnime) {
      try {
        const timeMatch = /^(\d{1,2}):(\d{2})/.exec(String(anime.broadcastTime));
        if (!timeMatch) {
          skipped++;
          continue;
        }
        const hour = parseInt(timeMatch[1], 10);
        const minute = parseInt(timeMatch[2], 10);
        const timezone = anime.broadcastTimezone || 'Asia/Tokyo';

        const nextAiringAt = getNextWeeklyOccurrenceUtc(anime.broadcastDay as string, hour, minute, timezone, referenceDate);
        if (!nextAiringAt) {
          skipped++;
          continue;
        }

        // The broadcast slot says *when* something airs, not *which* episode.
        // "Highest imported episode + 1" is only right if the import is
        // current — for long runners it isn't (One Piece's import stopped at
        // an episode from 2017, which produced "episode 801" in 2026). So
        // infer the number only when the highest recorded episode aired in
        // the previous slot; otherwise leave this show off the schedule
        // rather than publish an episode number we can't stand behind.
        const nextEpisodeNumber = await inferNextEpisodeNumber(anime.id, nextAiringAt);
        if (nextEpisodeNumber === null) {
          skipped++;
          continue;
        }

        if (anime.episodes && nextEpisodeNumber > anime.episodes) {
          // Already at/past its known final episode count — status hasn't
          // caught up to "Finished" yet, but don't schedule a phantom one.
          skipped++;
          continue;
        }

        const existing = await prisma.airingSchedule.findUnique({
          where: {
            animeId_episode_releaseType: {
              animeId: anime.id,
              episode: nextEpisodeNumber,
              releaseType: 'BROADCAST',
            },
          },
        });

        await ScheduleEngine.ingestScheduleEvent({
          animeId: anime.id,
          episode: nextEpisodeNumber,
          airingAt: nextAiringAt,
          originalTimezone: timezone,
          releaseType: 'BROADCAST',
          region: 'JP',
          // Inferred from a weekly slot, not a source listing this episode.
          isVerified: false,
          sourceProvider: 'jikan',
        });

        processed++;
        if (existing) updated++;
        else created++;
      } catch (e) {
        skipped++;
      }
    }

    // Second pass: premiere dates for announced-but-unaired shows. This is
    // a different shape of fact from the recurring weekly slot above — a
    // one-time "episode 1 airs on this date" rather than "airs every
    // Sunday" — so it's handled separately rather than folded into the
    // loop above.
    const upcomingAnime = await prisma.anime.findMany({
      where: {
        status: { in: ['Not yet aired', 'Not Yet Aired', 'NOT_YET_AIRED'] },
        airedFrom: { not: null, gte: referenceDate },
      },
      select: { id: true, airedFrom: true, broadcastDay: true, broadcastTime: true, broadcastTimezone: true },
    });

    for (const anime of upcomingAnime) {
      try {
        const existing = await prisma.airingSchedule.findUnique({
          where: { animeId_episode_releaseType: { animeId: anime.id, episode: 1, releaseType: 'BROADCAST' } },
        });

        const timeMatch = anime.broadcastTime ? /^(\d{1,2}):(\d{2})/.exec(anime.broadcastTime) : null;
        const timezone = anime.broadcastTimezone || 'Asia/Tokyo';

        // MAL gives a firm premiere date well before it gives a broadcast
        // time slot — most upcoming shows have one without the other. When
        // only the date is known, that's the real, honest state of the
        // data: better to show "airs <date>, time TBA" (isVerified: false)
        // than to guess a time and present it as confirmed.
        const premiereAt = timeMatch
          ? combineDateWithZonedTime(anime.airedFrom as Date, parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), timezone)
          : (anime.airedFrom as Date);

        await ScheduleEngine.ingestScheduleEvent({
          animeId: anime.id,
          episode: 1,
          airingAt: premiereAt,
          originalTimezone: timezone,
          releaseType: 'BROADCAST',
          region: 'JP',
          isVerified: Boolean(timeMatch),
          sourceProvider: 'jikan',
          notes: timeMatch ? null : 'Premiere date confirmed; exact broadcast time not yet announced (shown at 00:00 JST).',
        });

        processed++;
        if (existing) updated++;
        else created++;
      } catch (e) {
        skipped++;
      }
    }

    return { processed, created, updated, skipped };
  }
}
