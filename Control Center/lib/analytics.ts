/**
 * Control center analytics (2026-10-28): one function per section — anime,
 * news, collections, members, community. Everything is counted from stored
 * rows (plain SQL); nothing is estimated. Page views come from
 * PageViewDaily, which starts counting on 2026-10-28.
 */
import { prisma } from '@/lib/prisma';

const n = (v: unknown) => Number(v ?? 0);
export type DayPoint = { day: string; value: number };
export type Ranked = { id: string; label: string; sub?: string | null; href?: string | null; image?: string | null; value: number; extra?: number };
export type Slice = { label: string; value: number };

/** Zero-filled daily series for the last `days` days (UTC). */
function series(rows: { day: Date | string; value: unknown }[], days: number): DayPoint[] {
  const map = new Map(rows.map((r) => [new Date(r.day).toISOString().slice(0, 10), n(r.value)]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    return { day: key, value: map.get(key) ?? 0 };
  });
}
const total = (s: DayPoint[]) => s.reduce((a, p) => a + p.value, 0);

// ── Anime ────────────────────────────────────────────────────────────────
export async function getAnimeAnalytics(days = 30) {
  const since = Prisma_days(days);
  const [kpi, views, topViewed, lib, libDays, topLibrary, topRetention, genres, formats, decades, completeness] = await Promise.all([
    prisma.$queryRaw<Record<string, bigint>[]>`
      SELECT COUNT(*) AS catalog,
             COUNT(*) FILTER (WHERE "createdAt" >= ${since}) AS added,
             COUNT(*) FILTER (WHERE "externalSource" = 'manual') AS manual,
             COUNT(*) FILTER (WHERE status ILIKE '%airing%' AND status NOT ILIKE '%finished%') AS airing,
             COUNT(*) FILTER (WHERE status ILIKE '%not yet%') AS upcoming,
             COUNT(*) FILTER (WHERE status ILIKE 'finished%') AS finished
      FROM "Anime" WHERE "isAdult" = false AND status <> 'MERGED'`,
    prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT day, SUM(views) AS value FROM "PageViewDaily" WHERE kind = 'anime' AND day >= ${since}::date GROUP BY day`,
    prisma.$queryRaw<{ id: string; title: string; slug: string; poster: string | null; value: bigint }[]>`
      SELECT a.id, a."canonicalTitle" AS title, a.slug, a."posterUrl" AS poster, SUM(v.views) AS value
      FROM "PageViewDaily" v JOIN "Anime" a ON a.id = v."entityId"
      WHERE v.kind = 'anime' AND v.day >= ${since}::date
      GROUP BY a.id ORDER BY value DESC LIMIT 15`,
    prisma.$queryRaw<{ label: string; value: bigint }[]>`SELECT status AS label, COUNT(*) AS value FROM "UserAnime" GROUP BY status ORDER BY value DESC`,
    prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS value FROM "UserAnime" WHERE "createdAt" >= ${since} GROUP BY 1`,
    prisma.$queryRaw<{ id: string; title: string; slug: string; poster: string | null; value: bigint }[]>`
      SELECT a.id, a."canonicalTitle" AS title, a.slug, a."posterUrl" AS poster, COUNT(*) AS value
      FROM "UserAnime" u JOIN "Anime" a ON a.id = u."animeId" GROUP BY a.id ORDER BY value DESC LIMIT 10`,
    prisma.$queryRaw<{ id: string; title: string; slug: string; poster: string | null; value: number; members: bigint }[]>`
      SELECT a.id, a."canonicalTitle" AS title, a.slug, a."posterUrl" AS poster,
             ROUND(AVG(e.retention))::int AS value, COUNT(DISTINCT e."userId") AS members
      FROM "EpisodeRating" e JOIN "Anime" a ON a.id = e."animeId"
      WHERE e.retention IS NOT NULL GROUP BY a.id
      HAVING COUNT(DISTINCT e."userId") >= 1
      ORDER BY members DESC, value DESC LIMIT 10`,
    prisma.$queryRaw<{ label: string; value: bigint; tracked: bigint }[]>`
      SELECT g.name AS label, COUNT(DISTINCT ag."animeId") AS value,
             (SELECT COUNT(*) FROM "UserAnime" u JOIN "AnimeGenre" x ON x."animeId" = u."animeId" WHERE x."genreId" = g.id) AS tracked
      FROM "Genre" g JOIN "AnimeGenre" ag ON ag."genreId" = g.id
      WHERE g.name NOT IN ('Hentai', 'Erotica')
      GROUP BY g.id ORDER BY value DESC LIMIT 18`,
    prisma.$queryRaw<{ label: string; value: bigint }[]>`
      SELECT type AS label, COUNT(*) AS value FROM "Anime" WHERE "isAdult" = false AND status <> 'MERGED' GROUP BY type ORDER BY value DESC`,
    prisma.$queryRaw<{ label: string; value: bigint }[]>`
      SELECT (FLOOR(COALESCE(year, "startYear") / 10) * 10)::int::text || 's' AS label, COUNT(*) AS value
      FROM "Anime" WHERE "isAdult" = false AND status <> 'MERGED' AND COALESCE(year, "startYear") IS NOT NULL
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<Record<string, bigint>[]>`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE "posterUrl" <> '') AS poster,
             COUNT(*) FILTER (WHERE "bannerUrl" IS NOT NULL AND "bannerUrl" <> '') AS banner,
             COUNT(*) FILTER (WHERE "trailerUrl" IS NOT NULL AND "trailerUrl" <> '') AS trailer,
             COUNT(*) FILTER (WHERE synopsis <> '') AS synopsis,
             COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "AnimeStudio" s WHERE s."animeId" = "Anime".id)) AS studios,
             COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "AnimeCharacter" c WHERE c."animeId" = "Anime".id)) AS characters,
             COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "StreamingAvailability" w WHERE w."animeId" = "Anime".id)) AS streaming
      FROM "Anime" WHERE "isAdult" = false AND status <> 'MERGED'`,
  ]);
  const viewSeries = series(views, days);
  const c = completeness[0];
  const pctOf = (k: string) => (n(c.total) ? Math.round((n(c[k]) / n(c.total)) * 100) : 0);
  const animeRow = (r: { id: string; title: string; slug: string; poster: string | null; value: unknown }) => ({
    id: r.id,
    label: r.title,
    href: `/control/anime/${r.id}`,
    image: r.poster,
    value: n(r.value),
  });
  return {
    kpi: {
      catalog: n(kpi[0].catalog),
      added: n(kpi[0].added),
      manual: n(kpi[0].manual),
      airing: n(kpi[0].airing),
      upcoming: n(kpi[0].upcoming),
      finished: n(kpi[0].finished),
      views: total(viewSeries),
      viewsToday: viewSeries[viewSeries.length - 1]?.value ?? 0,
    },
    viewSeries,
    topViewed: topViewed.map(animeRow),
    libraryStatus: lib.map((r) => ({ label: r.label, value: n(r.value) })),
    libraryAdds: series(libDays, days),
    topLibrary: topLibrary.map(animeRow),
    topRetention: topRetention.map((r) => ({ ...animeRow(r), sub: `${n(r.members)} member${n(r.members) === 1 ? '' : 's'} rating episodes` })),
    genres: genres.map((r) => ({ label: r.label, value: n(r.value), extra: n(r.tracked) })),
    formats: formats.map((r) => ({ label: r.label, value: n(r.value) })),
    decades: decades.map((r) => ({ label: r.label, value: n(r.value) })),
    completeness: [
      { label: 'Poster', value: pctOf('poster') },
      { label: 'Synopsis', value: pctOf('synopsis') },
      { label: 'Studio linked', value: pctOf('studios') },
      { label: 'Where to watch', value: pctOf('streaming') },
      { label: 'Banner', value: pctOf('banner') },
      { label: 'Trailer', value: pctOf('trailer') },
      { label: 'Characters', value: pctOf('characters') },
    ],
  };
}

// ── News ─────────────────────────────────────────────────────────────────
export async function getNewsAnalytics(days = 30) {
  const since = Prisma_days(days);
  const [kpi, published, opens, views, byCategory, bySource, topOpened, own] = await Promise.all([
    prisma.$queryRaw<Record<string, bigint>[]>`
      SELECT COUNT(*) FILTER (WHERE status = 'PUBLISHED') AS published,
             COUNT(*) FILTER (WHERE status = 'PUBLISHED' AND "publishedAt" >= NOW() - INTERVAL '24 hours') AS day,
             COUNT(*) FILTER (WHERE status = 'PUBLISHED' AND "publishedAt" >= NOW() - INTERVAL '7 days') AS week,
             COUNT(*) FILTER (WHERE provider = 'INTERNAL') AS own,
             COUNT(*) FILTER (WHERE "isFeatured") AS featured,
             (SELECT COUNT(*) FROM "EventLog" WHERE "eventType" = 'NEWS_OPENED' AND "createdAt" >= ${since}) AS opens,
             (SELECT COUNT(*) FROM "EventLog" WHERE "eventType" = 'NEWS_SOURCE_OPENED' AND "createdAt" >= ${since}) AS source_clicks,
             (SELECT COUNT(*) FROM "EventLog" WHERE "eventType" = 'NEWS_SHARED' AND "createdAt" >= ${since}) AS shares
      FROM "NewsArticle" WHERE "deletedAt" IS NULL`,
    prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT date_trunc('day', "publishedAt") AS day, COUNT(*) AS value FROM "NewsArticle"
      WHERE "deletedAt" IS NULL AND status = 'PUBLISHED' AND "publishedAt" >= ${since} GROUP BY 1`,
    prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS value FROM "EventLog"
      WHERE "eventType" = 'NEWS_OPENED' AND "createdAt" >= ${since} GROUP BY 1`,
    prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT day, SUM(views) AS value FROM "PageViewDaily" WHERE kind = 'news' AND day >= ${since}::date GROUP BY day`,
    prisma.$queryRaw<{ label: string; value: bigint }[]>`
      SELECT COALESCE("adminOverrideCategory", category) AS label, COUNT(*) AS value FROM "NewsArticle"
      WHERE "deletedAt" IS NULL AND status = 'PUBLISHED' GROUP BY 1 ORDER BY value DESC`,
    prisma.$queryRaw<{ label: string; value: bigint }[]>`
      SELECT "sourceName" AS label, COUNT(*) AS value FROM "NewsArticle"
      WHERE "deletedAt" IS NULL AND status = 'PUBLISHED' GROUP BY 1 ORDER BY value DESC LIMIT 10`,
    prisma.$queryRaw<{ id: string; title: string; slug: string; image: string | null; value: bigint }[]>`
      SELECT n.id, COALESCE(n."adminOverrideTitle", n.title) AS title, n.slug, n."imageUrl" AS image, COUNT(*) AS value
      FROM "EventLog" e JOIN "NewsArticle" n ON n.id = e."entityId"
      WHERE e."eventType" = 'NEWS_OPENED' AND e."createdAt" >= ${since}
      GROUP BY n.id ORDER BY value DESC LIMIT 12`,
    prisma.$queryRaw<{ id: string; title: string; slug: string; image: string | null; status: string; value: bigint }[]>`
      SELECT n.id, n.title, n.slug, n."imageUrl" AS image, n.status,
             (SELECT COUNT(*) FROM "EventLog" e WHERE e."eventType" = 'NEWS_OPENED' AND e."entityId" = n.id) +
             COALESCE((SELECT SUM(views) FROM "PageViewDaily" v WHERE v.kind = 'news' AND v."entityId" = n.id), 0) AS value
      FROM "NewsArticle" n WHERE n.provider = 'INTERNAL' AND n."deletedAt" IS NULL
      ORDER BY n."publishedAt" DESC LIMIT 20`,
  ]);
  const k = kpi[0];
  const newsRow = (r: { id: string; title: string; image: string | null; value: unknown }) => ({ id: r.id, label: r.title, image: r.image, href: `/control/news/${r.id}`, value: n(r.value) });
  return {
    kpi: {
      published: n(k.published),
      day: n(k.day),
      week: n(k.week),
      own: n(k.own),
      featured: n(k.featured),
      opens: n(k.opens),
      sourceClicks: n(k.source_clicks),
      shares: n(k.shares),
    },
    publishedSeries: series(published, days),
    opensSeries: series(opens, days),
    viewSeries: series(views, days),
    byCategory: byCategory.map((r) => ({ label: r.label, value: n(r.value) })),
    bySource: bySource.map((r) => ({ label: r.label, value: n(r.value) })),
    topOpened: topOpened.map(newsRow),
    own: own.map((r) => ({ ...newsRow(r), sub: r.status === 'PUBLISHED' ? 'Published' : 'Draft' })),
  };
}

// ── Collections ──────────────────────────────────────────────────────────
export async function getCollectionAnalytics(days = 30) {
  const since = Prisma_days(days);
  const [kpi, created, views, topViewed, largest, mostCollected, chartViews] = await Promise.all([
    prisma.$queryRaw<Record<string, bigint>[]>`
      SELECT COUNT(*) AS lists,
             COUNT(*) FILTER (WHERE visibility = 'PUBLIC') AS public,
             COUNT(*) FILTER (WHERE visibility = 'LINK') AS link,
             COUNT(*) FILTER (WHERE visibility = 'PRIVATE') AS private,
             COUNT(DISTINCT "userId") AS owners,
             (SELECT COUNT(*) FROM "UserListItem") AS items
      FROM "UserList"`,
    prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS value FROM "UserList" WHERE "createdAt" >= ${since} GROUP BY 1`,
    prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT day, SUM(views) AS value FROM "PageViewDaily" WHERE kind = 'collection' AND day >= ${since}::date GROUP BY day`,
    prisma.$queryRaw<{ id: string; name: string; owner: string; value: bigint }[]>`
      SELECT l.id, l.name, u.username AS owner, SUM(v.views) AS value
      FROM "PageViewDaily" v JOIN "UserList" l ON l.id = v."entityId" JOIN "User" u ON u.id = l."userId"
      WHERE v.kind = 'collection' AND v.day >= ${since}::date GROUP BY l.id, u.username ORDER BY value DESC LIMIT 10`,
    prisma.$queryRaw<{ id: string; name: string; owner: string; visibility: string; value: bigint }[]>`
      SELECT l.id, l.name, u.username AS owner, l.visibility, COUNT(i.id) AS value
      FROM "UserList" l JOIN "User" u ON u.id = l."userId" LEFT JOIN "UserListItem" i ON i."listId" = l.id
      WHERE l.visibility <> 'PRIVATE' GROUP BY l.id, u.username ORDER BY value DESC LIMIT 10`,
    prisma.$queryRaw<{ id: string; title: string; poster: string | null; value: bigint }[]>`
      SELECT a.id, a."canonicalTitle" AS title, a."posterUrl" AS poster, COUNT(DISTINCT i."listId") AS value
      FROM "UserListItem" i JOIN "Anime" a ON a.id = i."animeId" GROUP BY a.id ORDER BY value DESC LIMIT 10`,
    prisma.$queryRaw<{ id: string; title: string; value: bigint }[]>`
      SELECT c.id, c.title, COALESCE(SUM(v.views), 0) AS value
      FROM "CuratedChart" c LEFT JOIN "PageViewDaily" v ON v.kind = 'chart' AND v."entityId" = c.id AND v.day >= ${since}::date
      WHERE c."isPublished" GROUP BY c.id ORDER BY value DESC LIMIT 10`,
  ]);
  const k = kpi[0];
  const viewSeries = series(views, days);
  return {
    kpi: {
      lists: n(k.lists),
      public: n(k.public),
      link: n(k.link),
      private: n(k.private),
      owners: n(k.owners),
      items: n(k.items),
      avg: n(k.lists) ? Math.round((n(k.items) / n(k.lists)) * 10) / 10 : 0,
      views: total(viewSeries),
    },
    createdSeries: series(created, days),
    viewSeries,
    topViewed: topViewed.map((r) => ({ id: r.id, label: r.name, sub: `by @${r.owner}`, value: n(r.value) })),
    largest: largest.map((r) => ({ id: r.id, label: r.name, sub: `by @${r.owner} · ${r.visibility === 'PUBLIC' ? 'public' : 'link only'}`, value: n(r.value) })),
    mostCollected: mostCollected.map((r) => ({ id: r.id, label: r.title, image: r.poster, href: `/control/anime/${r.id}`, value: n(r.value) })),
    chartViews: chartViews.map((r) => ({ id: r.id, label: r.title, href: `/control/charts/${r.id}`, value: n(r.value) })),
  };
}

// ── Members ──────────────────────────────────────────────────────────────
export async function getMemberAnalytics(days = 30) {
  const since = Prisma_days(days);
  const [kpi, signups, dau, roles, topActive, topFollowed] = await Promise.all([
    prisma.$queryRaw<Record<string, bigint>[]>`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE "createdAt" >= ${since}) AS new,
             COUNT(*) FILTER (WHERE "lastSeenAt" >= NOW() - INTERVAL '24 hours') AS today,
             COUNT(*) FILTER (WHERE "lastSeenAt" >= NOW() - INTERVAL '7 days') AS week,
             COUNT(*) FILTER (WHERE "lastSeenAt" >= NOW() - INTERVAL '30 days') AS month,
             COUNT(*) FILTER (WHERE "lastSeenAt" < NOW() - INTERVAL '30 days') AS inactive,
             COUNT(*) FILTER (WHERE "phoneVerifiedAt" IS NOT NULL) AS verified,
             COUNT(*) FILTER (WHERE "passwordHash" IS NOT NULL) AS password,
             (SELECT COUNT(*) FROM "Follow") AS follows
      FROM "User"`,
    prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS value FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1`,
    // Members who did something (rated, reviewed, tracked, posted…) each day.
    prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT day, COUNT(DISTINCT uid) AS value FROM (
        SELECT date_trunc('day', "createdAt") AS day, "userId" AS uid FROM "Activity" WHERE "createdAt" >= ${since}
        UNION ALL SELECT date_trunc('day', "createdAt"), "userId" FROM "EpisodeRating" WHERE "createdAt" >= ${since}
        UNION ALL SELECT date_trunc('day', "createdAt"), "userId" FROM "Review" WHERE "createdAt" >= ${since}
        UNION ALL SELECT date_trunc('day', "updatedAt"), "userId" FROM "UserAnime" WHERE "updatedAt" >= ${since}
      ) t WHERE uid IS NOT NULL GROUP BY day`,
    prisma.$queryRaw<{ label: string; value: bigint }[]>`SELECT role AS label, COUNT(*) AS value FROM "User" GROUP BY role ORDER BY value DESC`,
    prisma.$queryRaw<{ id: string; username: string; value: bigint }[]>`
      SELECT u.id, u.username, COUNT(*) AS value FROM (
        SELECT "userId" FROM "Activity" WHERE "createdAt" >= ${since}
        UNION ALL SELECT "userId" FROM "EpisodeRating" WHERE "createdAt" >= ${since}
        UNION ALL SELECT "userId" FROM "Review" WHERE "createdAt" >= ${since}
      ) t JOIN "User" u ON u.id = t."userId" GROUP BY u.id ORDER BY value DESC LIMIT 10`,
    prisma.$queryRaw<{ id: string; username: string; role: string; value: bigint }[]>`
      SELECT u.id, u.username, u.role, COUNT(*) AS value FROM "Follow" f JOIN "User" u ON u.id = f."followingId"
      GROUP BY u.id ORDER BY value DESC LIMIT 10`,
  ]);
  const k = kpi[0];
  return {
    kpi: {
      total: n(k.total),
      new: n(k.new),
      today: n(k.today),
      week: n(k.week),
      month: n(k.month),
      inactive: n(k.inactive),
      verified: n(k.verified),
      password: n(k.password),
      follows: n(k.follows),
    },
    signupSeries: series(signups, days),
    activeSeries: series(dau, days),
    roles: roles.map((r) => ({ label: r.label.replace('_', ' '), value: n(r.value) })),
    topActive: topActive.map((r) => ({ id: r.id, label: `@${r.username}`, href: `/profile/${r.username}`, value: n(r.value) })),
    topFollowed: topFollowed.map((r) => ({ id: r.id, label: `@${r.username}`, sub: r.role === 'CREATOR' ? 'Creator' : null, href: `/profile/${r.username}`, value: n(r.value) })),
  };
}

// ── Community ────────────────────────────────────────────────────────────
export async function getCommunityAnalytics(days = 30) {
  const since = Prisma_days(days);
  const [kpi, reviews, ratings, hype, topReviewers, communities, reports, articleViews, topArticles] = await Promise.all([
    prisma.$queryRaw<Record<string, bigint>[]>`
      SELECT (SELECT COUNT(*) FROM "Review" WHERE status = 'PUBLISHED' AND "deletedAt" IS NULL) AS reviews,
             (SELECT COUNT(*) FROM "Review" WHERE status = 'PUBLISHED' AND "deletedAt" IS NULL AND "isCreatorReview") AS creator_reviews,
             (SELECT COUNT(*) FROM "EpisodeRating" WHERE retention IS NOT NULL) AS ratings,
             (SELECT COUNT(*) FROM "AnimeHype" WHERE level = 'HYPED') AS hype,
             (SELECT COUNT(*) FROM "Discussion") AS discussions,
             (SELECT COUNT(*) FROM "UserArticle" WHERE "deletedAt" IS NULL) AS articles,
             (SELECT COUNT(*) FROM "Community" WHERE "deletedAt" IS NULL) AS communities,
             (SELECT COUNT(*) FROM "Report" WHERE status = 'OPEN') AS open_reports,
             (SELECT COUNT(*) FROM "Favorite") AS favorites`,
    prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS value FROM "Review" WHERE "createdAt" >= ${since} AND "deletedAt" IS NULL GROUP BY 1`,
    prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS value FROM "EpisodeRating" WHERE "createdAt" >= ${since} GROUP BY 1`,
    prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS value FROM "AnimeHype" WHERE "createdAt" >= ${since} GROUP BY 1`,
    prisma.$queryRaw<{ id: string; username: string; value: bigint }[]>`
      SELECT u.id, u.username, COUNT(*) AS value FROM "Review" r JOIN "User" u ON u.id = r."userId"
      WHERE r.status = 'PUBLISHED' AND r."deletedAt" IS NULL GROUP BY u.id ORDER BY value DESC LIMIT 10`,
    prisma.$queryRaw<{ id: string; name: string; slug: string; visibility: string; value: number }[]>`
      SELECT id, name, slug, visibility, "memberCount" AS value FROM "Community" WHERE "deletedAt" IS NULL ORDER BY "memberCount" DESC LIMIT 10`,
    prisma.$queryRaw<{ label: string; value: bigint }[]>`
      SELECT "targetType" || ' · ' || status AS label, COUNT(*) AS value FROM "Report" GROUP BY "targetType", status ORDER BY value DESC LIMIT 10`,
    prisma.$queryRaw<{ day: Date; value: bigint }[]>`
      SELECT day, SUM(views) AS value FROM "PageViewDaily" WHERE kind = 'article' AND day >= ${since}::date GROUP BY day`,
    prisma.$queryRaw<{ id: string; title: string; author: string; value: bigint }[]>`
      SELECT a.id, a.title, u.username AS author,
             COALESCE((SELECT SUM(views) FROM "PageViewDaily" v WHERE v.kind = 'article' AND v."entityId" = a.id), 0)
             + (SELECT COUNT(*) FROM "UserArticleLike" l WHERE l."articleId" = a.id) AS value
      FROM "UserArticle" a JOIN "User" u ON u.id = a."authorId" WHERE a."deletedAt" IS NULL
      ORDER BY value DESC LIMIT 10`,
  ]);
  const k = kpi[0];
  return {
    kpi: {
      reviews: n(k.reviews),
      creatorReviews: n(k.creator_reviews),
      ratings: n(k.ratings),
      hype: n(k.hype),
      discussions: n(k.discussions),
      articles: n(k.articles),
      communities: n(k.communities),
      openReports: n(k.open_reports),
      favorites: n(k.favorites),
    },
    reviewSeries: series(reviews, days),
    ratingSeries: series(ratings, days),
    hypeSeries: series(hype, days),
    articleViewSeries: series(articleViews, days),
    topReviewers: topReviewers.map((r) => ({ id: r.id, label: `@${r.username}`, href: `/profile/${r.username}`, value: n(r.value) })),
    communities: communities.map((r) => ({ id: r.id, label: r.name, sub: r.visibility.toLowerCase(), href: `/community/${r.slug}`, value: n(r.value) })),
    reports: reports.map((r) => ({ label: r.label, value: n(r.value) })),
    topArticles: topArticles.map((r) => ({ id: r.id, label: r.title, sub: `by @${r.author}`, href: `/control/articles/${r.id}`, value: n(r.value) })),
  };
}

function Prisma_days(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d;
}
