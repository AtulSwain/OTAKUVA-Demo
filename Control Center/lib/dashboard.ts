/**
 * Control center dashboard lists (2026-10-28): who is active, what premieres
 * next, what is on air, what members are hyped about and what gets reviewed.
 * All counted from stored rows (plain SQL — some columns are newer than the
 * running Prisma client may be). Nothing estimated.
 */
import { prisma } from '@/lib/prisma';

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

export interface AccountActivity {
  total: number;
  today: number;
  week: number;
  month: number;
  /** Signed in before but not seen for 30+ days. */
  inactive: number;
  /** Never seen since activity tracking started (2026-10-28). */
  neverSeen: number;
}

export interface DashAnime {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  type: string | null;
  /** ISO time it premieres / next episode airs, when known. */
  at: string | null;
  episode: number | null;
  count: number;
  extra?: number;
}

export async function getAccountActivity(): Promise<AccountActivity> {
  const [r] = await prisma.$queryRaw<Record<string, bigint>[]>`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE "lastSeenAt" >= NOW() - INTERVAL '24 hours') AS today,
           COUNT(*) FILTER (WHERE "lastSeenAt" >= NOW() - INTERVAL '7 days') AS week,
           COUNT(*) FILTER (WHERE "lastSeenAt" >= NOW() - INTERVAL '30 days') AS month,
           COUNT(*) FILTER (WHERE "lastSeenAt" < NOW() - INTERVAL '30 days') AS inactive,
           COUNT(*) FILTER (WHERE "lastSeenAt" IS NULL) AS never_seen
    FROM "User"`;
  return { total: n(r.total), today: n(r.today), week: n(r.week), month: n(r.month), inactive: n(r.inactive), neverSeen: n(r.never_seen) };
}

type Row = { id: string; slug: string; title: string; posterUrl: string | null; type: string | null; at: Date | null; episode: number | null; count: bigint | number; extra?: bigint | number };
const toDash = (r: Row): DashAnime => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  posterUrl: r.posterUrl || null,
  type: r.type,
  at: r.at ? new Date(r.at).toISOString() : null,
  episode: r.episode,
  count: n(r.count),
  ...(r.extra !== undefined ? { extra: n(r.extra) } : {}),
});

/** Anime whose episode 1 airs in the next `days` days (schedule first, else the start date), soonest first, with hype votes. */
export async function getPremieringSoon(days = 60, limit = 24): Promise<DashAnime[]> {
  const rows = await prisma.$queryRaw<Row[]>`
    WITH first_ep AS (
      SELECT "animeId", MIN("airingAt") AS at FROM "AiringSchedule"
      WHERE episode = 1 AND "airingAt" > NOW() GROUP BY "animeId"
    )
    SELECT a.id, a.slug, a."canonicalTitle" AS title, a."posterUrl", a.type,
           COALESCE(f.at, a."startDate") AS at, 1 AS episode,
           (SELECT COUNT(*) FROM "AnimeHype" h WHERE h."animeId" = a.id AND h.level = 'HYPED') AS count
    FROM "Anime" a
    LEFT JOIN first_ep f ON f."animeId" = a.id
    WHERE a."isAdult" = false AND a.status <> 'MERGED'
      AND COALESCE(f.at, a."startDate") > NOW()
      AND COALESCE(f.at, a."startDate") < NOW() + make_interval(days => ${days}::int)
    ORDER BY at ASC, a.members DESC NULLS LAST
    LIMIT ${limit}`;
  return rows.map(toDash);
}

/** On air now: shows with a next episode scheduled, the soonest first. */
export async function getAiringNow(limit = 24): Promise<DashAnime[]> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT a.id, a.slug, a."canonicalTitle" AS title, a."posterUrl", a.type,
           a."nextAiringAt" AS at, a."nextAiringEpisode" AS episode,
           (SELECT COUNT(DISTINCT e."userId") FROM "EpisodeRating" e WHERE e."animeId" = a.id) AS count
    FROM "Anime" a
    WHERE a."isAdult" = false AND a.status <> 'MERGED'
      AND a."nextAiringAt" > NOW() - INTERVAL '1 day'
      AND a."nextAiringEpisode" > 1
    ORDER BY a."nextAiringAt" ASC
    LIMIT ${limit}`;
  return rows.map(toDash);
}

/** Most "Hyped" votes (current level only; retired levels aren't counted), any premiere status. */
export async function getMostHyped(limit = 15): Promise<DashAnime[]> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT a.id, a.slug, a."canonicalTitle" AS title, a."posterUrl", a.type,
           COALESCE(a."nextAiringAt", a."startDate") AS at, NULL::int AS episode,
           COUNT(*) AS count
    FROM "AnimeHype" h JOIN "Anime" a ON a.id = h."animeId"
    WHERE h.level = 'HYPED'
    GROUP BY a.id
    ORDER BY count DESC, a.members DESC NULLS LAST
    LIMIT ${limit}`;
  return rows.map(toDash);
}

/** Most published reviews; `extra` = reviews in the last 30 days. */
export async function getMostReviewed(limit = 15): Promise<DashAnime[]> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT a.id, a.slug, a."canonicalTitle" AS title, a."posterUrl", a.type,
           NULL::timestamp AS at, NULL::int AS episode,
           COUNT(*) AS count,
           COUNT(*) FILTER (WHERE r."createdAt" >= NOW() - INTERVAL '30 days') AS extra
    FROM "Review" r JOIN "Anime" a ON a.id = r."animeId"
    WHERE r.status = 'PUBLISHED' AND r."deletedAt" IS NULL
    GROUP BY a.id
    ORDER BY count DESC, extra DESC
    LIMIT ${limit}`;
  return rows.map(toDash);
}

/** Most members rating episodes (retention); `extra` = number of ratings. */
export async function getMostRated(limit = 15): Promise<DashAnime[]> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT a.id, a.slug, a."canonicalTitle" AS title, a."posterUrl", a.type,
           NULL::timestamp AS at, NULL::int AS episode,
           COUNT(DISTINCT e."userId") AS count, COUNT(*) AS extra
    FROM "EpisodeRating" e JOIN "Anime" a ON a.id = e."animeId"
    WHERE e.retention IS NOT NULL
    GROUP BY a.id
    ORDER BY count DESC, extra DESC
    LIMIT ${limit}`;
  return rows.map(toDash);
}

/** Lowest community score, with a small sample floor so one accidental rating does not dominate. */
export async function getWorstRated(limit = 25): Promise<DashAnime[]> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT a.id, a.slug, a."canonicalTitle" AS title, a."posterUrl", a.type,
           NULL::timestamp AS at, NULL::int AS episode,
           COALESCE(ra."rawAverage", 0) AS count, ra."ratingCount" AS extra
    FROM "RatingAggregate" ra JOIN "Anime" a ON a.id = ra."animeId"
    WHERE ra."ratingCount" >= 3 AND a."isAdult" = false AND a.status <> 'MERGED'
    ORDER BY ra."rawAverage" ASC NULLS LAST, ra."ratingCount" DESC
    LIMIT ${limit}`;
  return rows.map(toDash);
}
