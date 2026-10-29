/**
 * Control center overview numbers (2026-10-28). One round of COUNT queries,
 * plain SQL so it also reads the newer User columns (lastSeenAt) on a server
 * whose Prisma client predates them. Everything is counted, nothing estimated.
 */
import { prisma } from '@/lib/prisma';

type Row = Record<string, bigint | number | null>;
const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

export interface ControlOverview {
  users: { total: number; newToday: number; new7d: number; active24h: number; active7d: number; creators: number; staff: number; withPassword: number; phoneVerified: number };
  catalog: { anime: number; noPoster: number; noBanner: number; noTrailer: number; noSynopsis: number; airing: number; upcoming: number };
  people: { total: number; noPhoto: number; characters: number; charactersNoImage: number };
  studios: { total: number; noLogo: number; noFounded: number };
  community: { reviews: number; reviews7d: number; episodeRatings: number; discussions: number; articles: number; communities: number; openReports: number };
  news: { total: number; last24h: number };
  signups: { day: string; count: number }[];
}

export async function getControlOverview(): Promise<ControlOverview> {
  const [u, c, p, s, m, nw, sign] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE "createdAt" >= date_trunc('day', NOW())) AS new_today,
             COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days') AS new_7d,
             COUNT(*) FILTER (WHERE "lastSeenAt" >= NOW() - INTERVAL '24 hours') AS active_24h,
             COUNT(*) FILTER (WHERE "lastSeenAt" >= NOW() - INTERVAL '7 days') AS active_7d,
             COUNT(*) FILTER (WHERE role = 'CREATOR') AS creators,
             COUNT(*) FILTER (WHERE role NOT IN ('USER', 'CREATOR')) AS staff,
             COUNT(*) FILTER (WHERE "passwordHash" IS NOT NULL) AS with_password,
             COUNT(*) FILTER (WHERE "phoneVerifiedAt" IS NOT NULL) AS phone_verified
      FROM "User"`,
    prisma.$queryRaw<Row[]>`
      SELECT COUNT(*) AS anime,
             COUNT(*) FILTER (WHERE "posterUrl" IS NULL OR "posterUrl" = '') AS no_poster,
             COUNT(*) FILTER (WHERE "bannerUrl" IS NULL OR "bannerUrl" = '') AS no_banner,
             COUNT(*) FILTER (WHERE "trailerUrl" IS NULL OR "trailerUrl" = '') AS no_trailer,
             COUNT(*) FILTER (WHERE synopsis IS NULL OR synopsis = '') AS no_synopsis,
             COUNT(*) FILTER (WHERE status ILIKE '%airing%' AND status NOT ILIKE '%finished%' AND status NOT ILIKE '%not yet%') AS airing,
             COUNT(*) FILTER (WHERE status ILIKE '%not yet%' OR status ILIKE '%upcoming%') AS upcoming
      FROM "Anime" WHERE "isAdult" = false AND status <> 'MERGED'`,
    prisma.$queryRaw<Row[]>`
      SELECT (SELECT COUNT(*) FROM "Person") AS total,
             (SELECT COUNT(*) FROM "Person" WHERE "imageUrl" IS NULL OR "imageUrl" = '') AS no_photo,
             (SELECT COUNT(*) FROM "Character") AS characters,
             (SELECT COUNT(*) FROM "Character" WHERE "imageUrl" IS NULL OR "imageUrl" = '') AS characters_no_image`,
    prisma.$queryRaw<Row[]>`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE COALESCE("adminOverrideImageUrl", "imageUrl") IS NULL) AS no_logo,
             COUNT(*) FILTER (WHERE COALESCE("adminOverrideFoundedYear", "foundedYear") IS NULL) AS no_founded
      FROM "Studio" WHERE status <> 'MERGED'`,
    prisma.$queryRaw<Row[]>`
      SELECT (SELECT COUNT(*) FROM "Review" WHERE status = 'PUBLISHED' AND "deletedAt" IS NULL) AS reviews,
             (SELECT COUNT(*) FROM "Review" WHERE status = 'PUBLISHED' AND "deletedAt" IS NULL AND "createdAt" >= NOW() - INTERVAL '7 days') AS reviews_7d,
             (SELECT COUNT(*) FROM "EpisodeRating") AS episode_ratings,
             (SELECT COUNT(*) FROM "Discussion") AS discussions,
             (SELECT COUNT(*) FROM "UserArticle") AS articles,
             (SELECT COUNT(*) FROM "Community") AS communities,
             (SELECT COUNT(*) FROM "Report" WHERE status = 'OPEN') AS open_reports`,
    prisma.$queryRaw<Row[]>`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE "publishedAt" >= NOW() - INTERVAL '24 hours') AS last_24h
      FROM "NewsArticle" WHERE "deletedAt" IS NULL AND status = 'PUBLISHED'`,
    prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count
      FROM "User" WHERE "createdAt" >= date_trunc('day', NOW()) - INTERVAL '13 days'
      GROUP BY 1 ORDER BY 1`,
  ]);

  // Last 14 days, zero-filled.
  const byDay = new Map(sign.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]));
  const signups = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    return { day: key, count: byDay.get(key) ?? 0 };
  });

  return {
    users: {
      total: n(u[0].total),
      newToday: n(u[0].new_today),
      new7d: n(u[0].new_7d),
      active24h: n(u[0].active_24h),
      active7d: n(u[0].active_7d),
      creators: n(u[0].creators),
      staff: n(u[0].staff),
      withPassword: n(u[0].with_password),
      phoneVerified: n(u[0].phone_verified),
    },
    catalog: {
      anime: n(c[0].anime),
      noPoster: n(c[0].no_poster),
      noBanner: n(c[0].no_banner),
      noTrailer: n(c[0].no_trailer),
      noSynopsis: n(c[0].no_synopsis),
      airing: n(c[0].airing),
      upcoming: n(c[0].upcoming),
    },
    people: { total: n(p[0].total), noPhoto: n(p[0].no_photo), characters: n(p[0].characters), charactersNoImage: n(p[0].characters_no_image) },
    studios: { total: n(s[0].total), noLogo: n(s[0].no_logo), noFounded: n(s[0].no_founded) },
    community: {
      reviews: n(m[0].reviews),
      reviews7d: n(m[0].reviews_7d),
      episodeRatings: n(m[0].episode_ratings),
      discussions: n(m[0].discussions),
      articles: n(m[0].articles),
      communities: n(m[0].communities),
      openReports: n(m[0].open_reports),
    },
    news: { total: n(nw[0].total), last24h: n(nw[0].last_24h) },
    signups,
  };
}
