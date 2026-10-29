/**
 * The homepage's "front page" modules (2026-10-19 redesign): platform stats,
 * this season, latest reviews, rankings as tables, discussions, member
 * articles, communities, "on this day" and genres. Public data only, cached
 * like the other public homepage sections and invalidated by the same tag.
 *
 * Everything here is real data from the canonical DB; a module with nothing
 * to show returns an empty list and the page hides it — no placeholders.
 */
import { unstable_cache } from 'next/cache';
import { prisma } from '../prisma';
import { HOME_SECTIONS_CACHE_TAG } from './homeCacheTags';
import { sanitizePublicEntityName } from '../normalizers';
import { readableDiscussionsFilter } from '../engine/community/communityEngine';
import { listArticles } from '../articles/articleService';
import { getReviewerRatings, reviewerRatingFrom } from '../reviews/reviewerRatings';
import { getTierBriefs } from '../badges/queries';

const SEASONS = ['Winter', 'Spring', 'Summer', 'Fall'] as const;
const ADULT_GENRES = ['Hentai', 'Erotica'];
const LISTED_ANIME = { status: { not: 'MERGED' }, isAdult: false, posterUrl: { not: '' } } as const;

/**
 * "Most popular" counts OTAKUVA's own members tracking each show (UserAnime),
 * not provider member counts. It stays hidden until there's enough real data
 * to rank: at least POPULAR_MIN_SHOWS shows tracked by POPULAR_MIN_TRACKERS members.
 */
export const POPULAR_MIN_TRACKERS = 3;
export const POPULAR_MIN_SHOWS = 5;

export function currentSeason(now = new Date()) {
  return { season: SEASONS[Math.floor(now.getUTCMonth() / 3)], year: now.getUTCFullYear() };
}

const title = (t: string | null | undefined) => sanitizePublicEntityName(t || '') || '';

function excerpt(text: string, max = 220) {
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/[#*_>`~]/g, '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 3).trimEnd()}…` : clean;
}

const RANK_SELECT = {
  id: true,
  slug: true,
  canonicalTitle: true,
  posterUrl: true,
  type: true,
  year: true,
  score: true,
  members: true,
  animeGenres: { select: { genre: { select: { name: true } } }, take: 3 },
  ratingAggregate: { select: { rawAverage: true, ratingCount: true } },
} as const;

type RankRow = {
  id: string;
  slug: string;
  canonicalTitle: string;
  posterUrl: string;
  type: string | null;
  year: number | null;
  score: number | null;
  members: number | null;
  animeGenres: { genre: { name: string } }[];
  ratingAggregate: { rawAverage: number | null; ratingCount: number } | null;
};

function toRankItem(a: RankRow) {
  return {
    id: a.id,
    slug: a.slug,
    title: title(a.canonicalTitle),
    posterUrl: a.posterUrl,
    type: a.type,
    year: a.year,
    /** Provider score (MyAnimeList/AniList), labelled as such in the UI. */
    score: a.score,
    members: a.members,
    genres: a.animeGenres.map((g) => g.genre.name).filter((g) => !ADULT_GENRES.includes(g)),
    otakuvaScore: a.ratingAggregate && a.ratingAggregate.ratingCount > 0 ? a.ratingAggregate.rawAverage : null,
    otakuvaRatings: a.ratingAggregate?.ratingCount ?? 0,
  };
}

/** Uncached builder (tests call this directly); the page uses getFrontPageSections. */
export async function buildFrontPageSections(now = new Date()) {
  const { season, year } = currentSeason(now);
  // "This week in anime history": calendar days within 3 of today, as MMDD numbers.
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i - 3));
    return (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  });

  const [stats, seasonRows, seasonCount, mostPopular, highestRated, reviewRows, discussionRows, communityRows, articles, onThisDayIds, genreRows, studioRows] =
    await Promise.all([
      Promise.all([
        prisma.anime.count({ where: { status: { not: 'MERGED' }, isAdult: false } }),
        prisma.user.count(),
        prisma.review.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
        prisma.discussion.count({ where: { status: { not: 'HIDDEN' }, AND: [readableDiscussionsFilter(null)] } }),
        prisma.person.count(),
      ]),
      prisma.anime.findMany({
        where: { ...LISTED_ANIME, season: { equals: season, mode: 'insensitive' }, year },
        orderBy: [{ members: { sort: 'desc', nulls: 'last' } }],
        take: 12,
        select: RANK_SELECT,
      }),
      prisma.anime.count({ where: { status: { not: 'MERGED' }, isAdult: false, season: { equals: season, mode: 'insensitive' }, year } }),
      prisma.userAnime.groupBy({
        by: ['animeId'],
        where: { anime: LISTED_ANIME },
        _count: { animeId: true },
        having: { animeId: { _count: { gte: POPULAR_MIN_TRACKERS } } },
        orderBy: { _count: { animeId: 'desc' } },
        take: 8,
      }),
      prisma.anime.findMany({
        where: { ...LISTED_ANIME, score: { not: null }, scoredBy: { gte: 10000 } },
        orderBy: [{ score: { sort: 'desc', nulls: 'last' } }, { scoredBy: 'desc' }],
        take: 8,
        select: RANK_SELECT,
      }),
      prisma.review.findMany({
        where: { status: 'PUBLISHED', deletedAt: null, anime: { isAdult: false } },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          body: true,
          title: true,
          containsSpoiler: true,
          spoilerLevel: true,
          isCreatorReview: true,
          likesCount: true,
          createdAt: true,
          userId: true,
          animeId: true,
          user: { select: { username: true, avatarUrl: true, role: true, creatorChannelName: true } },
          anime: { select: { slug: true, canonicalTitle: true, posterUrl: true } },
        },
      }),
      prisma.discussion.findMany({
        where: { status: { in: ['ACTIVE', 'PINNED'] }, AND: [readableDiscussionsFilter(null)] },
        orderBy: [{ updatedAt: 'desc' }],
        take: 20,
        select: {
          id: true,
          title: true,
          replyCount: true,
          helpfulCount: true,
          updatedAt: true,
          author: { select: { username: true, avatarUrl: true } },
          community: { select: { name: true, slug: true } },
          anime: { select: { slug: true, canonicalTitle: true } },
        },
      }),
      prisma.community.findMany({
        where: { status: 'ACTIVE', deletedAt: null, visibility: { in: ['PUBLIC', 'REQUEST_TO_JOIN'] } },
        orderBy: [{ memberCount: 'desc' }, { updatedAt: 'desc' }],
        take: 4,
        select: { id: true, name: true, slug: true, iconUrl: true, memberCount: true, anime: { select: { canonicalTitle: true } } },
      }),
      listArticles({ limit: 3 }).catch(() => ({ articles: [] as Awaited<ReturnType<typeof listArticles>>['articles'] })),
      // Premiered this week (±3 days) in an earlier year; exact-day dates only.
      prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Anime"
        WHERE "datePrecision" = 'DAY' AND "startDate" IS NOT NULL
          AND status <> 'MERGED' AND "isAdult" = false AND "posterUrl" <> ''
          AND (EXTRACT(MONTH FROM "startDate") * 100 + EXTRACT(DAY FROM "startDate"))::int = ANY(${weekDays})
          AND EXTRACT(YEAR FROM "startDate") < ${now.getUTCFullYear()}
        ORDER BY members DESC NULLS LAST
        LIMIT 4`,
      prisma.genre.findMany({
        where: { name: { notIn: ADULT_GENRES } },
        select: { name: true, slug: true, _count: { select: { animeGenres: true } } },
        orderBy: { animeGenres: { _count: 'desc' } },
        take: 18,
      }),
      prisma.studio.findMany({
        where: { publicationState: 'PUBLISHED', status: { not: 'MERGED' }, slug: { not: null } },
        orderBy: [{ animeStudios: { _count: 'desc' } }],
        take: 5,
        select: { id: true, slug: true, name: true, adminOverrideName: true, _count: { select: { animeStudios: true } } },
      }),
    ]);

  const popularRows =
    mostPopular.length >= POPULAR_MIN_SHOWS
      ? await prisma.anime.findMany({ where: { id: { in: mostPopular.map((r) => r.animeId) } }, select: RANK_SELECT })
      : [];
  const trackers = new Map(mostPopular.map((r) => [r.animeId, r._count.animeId]));

  // Creators' latest episode ratings that came with a comment (2026-10-25,
  // owner): shown in Latest reviews, highlighted as a creator's take.
  const creatorEpisodeRows = await prisma.episodeRating.findMany({
    where: {
      review: { not: null },
      retention: { gte: 1, lte: 100 },
      episodeNumber: { not: null },
      user: { role: 'CREATOR' },
      anime: { isAdult: false },
    },
    orderBy: { updatedAt: 'desc' },
    take: 4,
    select: {
      id: true,
      episodeNumber: true,
      retention: true,
      review: true,
      updatedAt: true,
      userId: true,
      user: { select: { username: true, avatarUrl: true, creatorChannelName: true } },
      anime: { select: { id: true, slug: true, canonicalTitle: true, posterUrl: true } },
    },
  });

  const [ratings, tiers, onThisDayRows] = await Promise.all([
    getReviewerRatings(reviewRows.map((r) => ({ userId: r.userId, animeId: r.animeId }))),
    getTierBriefs(reviewRows.map((r) => r.userId)).catch(() => new Map()),
    onThisDayIds.length
      ? prisma.anime.findMany({ where: { id: { in: onThisDayIds.map((r) => r.id) } }, select: { ...RANK_SELECT, startDate: true } })
      : Promise.resolve([]),
  ]);

  // Trending = most talked about lately: replies + helpful votes, newest first on ties.
  const discussions = discussionRows
    .filter((d) => title(d.title))
    .sort((a, b) => b.replyCount + b.helpfulCount - (a.replyCount + a.helpfulCount) || b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 5);

  return {
    stats: { anime: stats[0], members: stats[1], reviews: stats[2], discussions: stats[3], people: stats[4] },
    season: { season, year, total: seasonCount, items: seasonRows.map(toRankItem) },
    rankings: {
      // Tracked by OTAKUVA members, most first; empty until there's enough data.
      mostPopular: popularRows
        .map((a) => ({ ...toRankItem(a), trackers: trackers.get(a.id) ?? 0 }))
        .sort((a, b) => b.trackers - a.trackers),
      highestRated: highestRated.map((a) => ({ ...toRankItem(a), trackers: 0 })),
    },
    reviews: reviewRows.map((r) => {
      const spoiler = r.containsSpoiler || (r.spoilerLevel && r.spoilerLevel !== 'SPOILER_FREE');
      return {
        id: r.id,
        // Spoiler reviews never show their text on the front page.
        excerpt: spoiler ? null : excerpt(r.body),
        spoiler: Boolean(spoiler),
        headline: r.title ? title(r.title) : '',
        isCreatorReview: r.isCreatorReview,
        likes: r.likesCount,
        createdAt: r.createdAt.toISOString(),
        rating: reviewerRatingFrom(ratings, r.userId, r.animeId),
        tier: tiers.get(r.userId)?.tier ?? 'shoshinsha',
        user: {
          username: r.user.username,
          avatarUrl: r.user.avatarUrl,
          isCreator: r.user.role === 'CREATOR',
          channelName: r.user.role === 'CREATOR' ? r.user.creatorChannelName : null,
        },
        anime: { id: r.animeId, slug: r.anime.slug, title: title(r.anime.canonicalTitle), posterUrl: r.anime.posterUrl },
      };
    }),
    creatorEpisodeNotes: creatorEpisodeRows.flatMap((e) => (!e.anime ? [] : [{
      id: e.id,
      episodeNumber: e.episodeNumber as number,
      retention: e.retention as number,
      comment: excerpt(e.review || ''),
      at: e.updatedAt.toISOString(),
      user: { username: e.user.username, avatarUrl: e.user.avatarUrl, channelName: e.user.creatorChannelName },
      anime: { id: e.anime.id, slug: e.anime.slug, title: title(e.anime.canonicalTitle), posterUrl: e.anime.posterUrl },
    }])),
    discussions: discussions.map((d) => ({
      id: d.id,
      title: title(d.title),
      replies: d.replyCount,
      updatedAt: d.updatedAt.toISOString(),
      author: d.author ? { username: d.author.username, avatarUrl: d.author.avatarUrl } : null,
      community: d.community ? { name: title(d.community.name), slug: d.community.slug } : null,
      anime: d.anime ? { slug: d.anime.slug, title: title(d.anime.canonicalTitle) } : null,
    })),
    communities: communityRows.map((c) => ({
      id: c.id,
      name: title(c.name),
      slug: c.slug,
      iconUrl: c.iconUrl,
      memberCount: c.memberCount,
      about: c.anime ? title(c.anime.canonicalTitle) : null,
    })),
    articles: articles.articles.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      createdAt: a.createdAt,
      author: a.author.username,
      anime: a.anime?.title ?? null,
      likeCount: a.likeCount,
      commentCount: a.commentCount,
    })),
    onThisDay: onThisDayRows
      .map((a) => ({
        ...toRankItem(a),
        premiered: a.startDate!.toISOString(),
        yearsAgo: now.getUTCFullYear() - a.startDate!.getUTCFullYear(),
        today: a.startDate!.getUTCMonth() === now.getUTCMonth() && a.startDate!.getUTCDate() === now.getUTCDate(),
      }))
      .sort((a, b) => (b.members ?? 0) - (a.members ?? 0)),
    genres: genreRows.map((g) => ({ name: g.name, slug: g.slug, count: g._count.animeGenres })),
    studios: studioRows.map((s) => ({ id: s.id, slug: s.slug!, name: title(s.adminOverrideName || s.name), works: s._count.animeStudios })),
  };
}

export const getFrontPageSections = unstable_cache(() => buildFrontPageSections(), ['home-front-page'], {
  revalidate: 60,
  tags: [HOME_SECTIONS_CACHE_TAG],
});

export type FrontPageData = Awaited<ReturnType<typeof buildFrontPageSections>>;
