import { unstable_cache } from 'next/cache';
import { HOME_SECTIONS_CACHE_TAG } from './homeCacheTags';
import { prisma } from '../prisma';
import { AuthenticatedUser } from '../auth';
import { sanitizePublicEntityName } from '../normalizers';
import { ensureFreshNews } from '../engine/news/newsFreshness';
import { ensureFreshSchedule } from '../engine/schedule/scheduleFreshness';
import { ensureHypePremiereNotifications } from '../hype/hypePremiere';
import { readableDiscussionsFilter } from '../engine/community/communityEngine';
import { getFrontPageSections } from './frontPage';

const BAD_PUBLIC_TEXT = /\b(test|placeholder|undefined|null|nan)\b|123456/i;

function isCleanText(value?: string | null) {
  if (!value) return false;
  const clean = sanitizePublicEntityName(value);
  return Boolean(clean) && !BAD_PUBLIC_TEXT.test(clean);
}

function normalizeStatus(status?: string | null) {
  const value = String(status || '').toUpperCase();
  if (value.includes('AIRING') || value === 'RELEASING') return 'Airing';
  if (value.includes('NOT') || value.includes('UPCOMING')) return 'Upcoming';
  return 'Finished';
}

function normalizeType(type?: string | null) {
  const value = String(type || 'TV').replace(/_/g, ' ').toUpperCase();
  if (value === 'MOVIE') return 'Movie';
  if (value === 'SPECIAL') return 'Special';
  if (value === 'OVA' || value === 'ONA') return value;
  return 'TV';
}

function mapAnime(anime: any) {
  const title = sanitizePublicEntityName(anime.canonicalTitle);
  if (!anime?.id || !anime?.slug || !isCleanText(title) || !anime.posterUrl) return null;

  return {
    id: anime.id,
    otakuva_anime_id: anime.id,
    slug: anime.slug,
    title,
    canonicalTitle: title,
    synopsis: anime.synopsis || '',
    type: normalizeType(anime.type),
    status: normalizeStatus(anime.status),
    episodes: anime.episodes,
    score: typeof anime.score === 'number' ? anime.score : null,
    // OTAKUVA's own score: the average of members' ratings (the same figure
    // the anime page shows). This used to be the provider score x10.
    otakuvaScore:
      anime.ratingAggregate?.ratingCount > 0 && typeof anime.ratingAggregate.rawAverage === 'number'
        ? anime.ratingAggregate.rawAverage
        : null,
    otakuvaRatingCount: anime.ratingAggregate?.ratingCount ?? 0,
    ratingCount: typeof anime.scoredBy === 'number' ? anime.scoredBy : 0,
    scoredBy: typeof anime.scoredBy === 'number' ? anime.scoredBy : 0,
    rank: typeof anime.rank === 'number' ? anime.rank : null,
    popularity: typeof anime.popularity === 'number' ? anime.popularity : null,
    posterImage: anime.posterUrl,
    posterUrl: anime.posterUrl,
    largePosterUrl: anime.largePosterUrl || anime.posterUrl,
    bannerImage: anime.bannerUrl || anime.largePosterUrl || anime.posterUrl,
    bannerUrl: anime.bannerUrl || anime.largePosterUrl || anime.posterUrl,
    trailerUrl: anime.trailerUrl || null,
    season: anime.season || null,
    year: anime.year || anime.startYear || anime.seasonYear || null,
    nextAiringEpisode: anime.nextAiringEpisode || null,
    nextAiringAt: anime.nextAiringAt ? anime.nextAiringAt.toISOString() : null,
    genres: Array.isArray(anime.animeGenres) ? anime.animeGenres.map((g: any) => g.genre.name).filter(isCleanText) : [],
    studios: Array.isArray(anime.animeStudios) ? anime.animeStudios.map((s: any) => sanitizePublicEntityName(s.studio.name)).filter(isCleanText) : [],
  };
}

function uniqueById<T extends { id: string }>(items: Array<T | null>) {
  const seen = new Set<string>();
  return items.filter((item): item is T => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

async function section<T>(fallback: T, loader: () => Promise<T>) {
  try {
    return { data: await loader(), error: null };
  } catch (error: any) {
    console.error('Home section failed:', error?.message || error);
    return { data: fallback, error: 'temporarily_unavailable' };
  }
}

/** Staff roles that make someone a creator of the show (homepage "Creators and Directors"). */
const CREATIVE_ROLES = [
  'Director',
  'Original Creator',
  'Original Story',
  'Series Composition',
  'Script',
  'Character Design',
  'Original Character Design',
  'Chief Animation Director',
  'Storyboard',
  'Music',
];
const CREATORS_PER_ROLE = 3;

const HERO_SIZE = 8;
/** Below this many recent releases, the hero tops up with all-time favourites. */
const HERO_MIN_LATEST = 4;

const animeInclude = {
  animeGenres: { include: { genre: true } },
  animeStudios: { include: { studio: true } },
  ratingAggregate: { select: { rawAverage: true, ratingCount: true } },
};

// Every section below is identical for every visitor — cached for 60s so
// the ~10 Prisma queries behind the homepage don't re-run on every request.
// Continue Watching is the one personalized section; it's deliberately
// computed outside this cache (see getContinueWatchingSection below) and
// never derived from or keyed by a specific user in here.
const getPublicHomeSections = unstable_cache(
  async () => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [hero, trending, topRated, airing, releaseSchedule, editorsPicks, studios, creators, news, community, recommendations] =
      await Promise.all([
        // 1. Hero: the latest released episodes (real AniList air times), most
        //    recent first, one slide per show. Falls back to the all-time
        //    best only when too little has aired recently to fill it.
        section([], async () => {
          const aired = await prisma.airingSchedule.findMany({
            where: {
              airingAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), lte: now },
              anime: {
                status: { not: 'MERGED' }, isAdult: false, posterUrl: { not: '' },
                OR: [{ bannerUrl: { not: null } }, { largePosterUrl: { not: null } }],
              },
            },
            orderBy: { airingAt: 'desc' },
            take: 80,
            include: { anime: { include: animeInclude } },
          });
          const seen = new Set<string>();
          const latest = aired.flatMap((s) => {
            if (seen.has(s.animeId)) return [];
            seen.add(s.animeId);
            const anime = mapAnime(s.anime);
            return anime ? [{ ...anime, latestEpisode: s.episode, latestAiredAt: s.airingAt.toISOString() }] : [];
          }).slice(0, HERO_SIZE);
          if (latest.length >= HERO_MIN_LATEST) return latest;

          const fallback = uniqueById((await prisma.anime.findMany({
            where: {
              status: { not: 'MERGED' }, isAdult: false,
              posterUrl: { not: '' },
              id: { notIn: latest.map((a) => a.id) },
              OR: [{ bannerUrl: { not: null } }, { largePosterUrl: { not: null } }],
            },
            orderBy: [{ score: { sort: 'desc', nulls: 'last' } }, { popularity: 'asc' }], // Postgres puts NULLs first under DESC
            take: HERO_SIZE,
            include: animeInclude,
          })).map(mapAnime));
          return [...latest, ...fallback].slice(0, HERO_SIZE);
        }),

        // 2. Most popular (by rank; no invented week-over-week figures)
        section([], async () => {
          const raw = uniqueById((await prisma.anime.findMany({
            where: { status: { not: 'MERGED' }, isAdult: false, posterUrl: { not: '' } },
            orderBy: [{ popularity: 'asc' }, { score: { sort: 'desc', nulls: 'last' } }],
            take: 14,
            include: animeInclude,
          })).map(mapAnime)).slice(0, 10);


          return raw.map((item, idx) => ({
            ...item,
            trendRank: String(idx + 1).padStart(2, '0'),
          }));
        }),

        // 3. Top Rated — released shows that already have a real ranking
        //    (provider score with at least 10k votes), highest first.
        section([], async () => uniqueById((await prisma.anime.findMany({
          where: {
            status: { notIn: ['MERGED', 'Not yet aired', 'Not Yet Aired', 'NOT_YET_AIRED', 'NOT_YET_RELEASED', 'Upcoming', 'UPCOMING'] },
            isAdult: false,
            posterUrl: { not: '' },
            score: { not: null },
            scoredBy: { gte: 10000 },
          },
          orderBy: [{ score: { sort: 'desc', nulls: 'last' } }, { scoredBy: 'desc' }],
          take: 15,
          include: animeInclude,
        })).map(mapAnime))),

        // 4. Airing / Seasonal
        section([], async () => {
          const schedules = await prisma.airingSchedule.findMany({
            where: { airingAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), lte: nextWeek } },
            orderBy: { airingAt: 'asc' },
            take: 12,
            include: { anime: { include: animeInclude } },
          });

          const seen = new Set<string>();
          return schedules.flatMap((item) => {
            if (seen.has(item.animeId)) return [];
            seen.add(item.animeId);
            const anime = mapAnime(item.anime);
            if (!anime) return [];
            return [{
              id: item.id,
              episodeNumber: item.episode,
              airingAt: item.airingAt.toISOString(),
              anime,
            }];
          });
        }),

        // 5. Release schedule: every episode from ~1.5 days back to 8 days out.
        //    Grouped into Today / Tomorrow / weekdays in the viewer's own
        //    timezone on the client, which is why the window is wider than a week.
        section([], async () => {
          const rows = await prisma.airingSchedule.findMany({
            where: {
              airingAt: { gte: new Date(now.getTime() - 36 * 60 * 60 * 1000), lte: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000) },
              releaseType: 'BROADCAST',
              anime: { status: { not: 'MERGED' }, isAdult: false },
            },
            orderBy: { airingAt: 'asc' },
            take: 400,
            select: {
              id: true,
              episode: true,
              airingAt: true,
              anime: { select: { id: true, slug: true, canonicalTitle: true, posterUrl: true, type: true, episodes: true } },
            },
          });
          return rows.flatMap((r) => {
            const title = sanitizePublicEntityName(r.anime.canonicalTitle);
            if (!r.anime.slug || !isCleanText(title)) return [];
            return [{
              id: r.id,
              episode: r.episode,
              airingAt: r.airingAt.toISOString(),
              anime: {
                id: r.anime.id,
                slug: r.anime.slug,
                title,
                posterUrl: r.anime.posterUrl || null,
                type: normalizeType(r.anime.type),
                totalEpisodes: r.anime.episodes ?? null,
              },
            }];
          });
        }),

        // 6. Editor's Picks (Magazine Feature)
        section([], async () => {
          const candidate = await prisma.anime.findFirst({
            where: {
              status: { not: 'MERGED' }, isAdult: false,
              posterUrl: { not: '' },
              OR: [
                { slug: 'monster' },
                { slug: 'frieren-beyond-journeys-end' },
                { slug: 'steins-gate' },
                { score: { gte: 9.0 } },
              ],
            },
            orderBy: [{ score: { sort: 'desc', nulls: 'last' } }],
            include: animeInclude,
          });

          if (!candidate) return [];
          const mapped = mapAnime(candidate);
          if (!mapped) return [];

          return [{
            ...mapped,
            // Chosen by score, not by an editor — labelled as such in the UI,
            // and described by its own synopsis rather than a canned blurb.
            editorialTitle: 'Spotlight',
            editorialTags: mapped.genres.slice(0, 3),
          }];
        }),

        // 7. Studios
        section([], async () => {
          const rows = await prisma.studio.findMany({
            where: {
              publicationState: 'PUBLISHED',
              status: { not: 'MERGED' },
              slug: { not: null },
            },
            // The studios with the most catalogued work — the names people know.
            orderBy: [{ animeStudios: { _count: 'desc' } }, { updatedAt: 'desc' }],
            take: 8,
            include: {
              _count: { select: { animeStudios: true } },
              animeStudios: {
                take: 4,
                include: { anime: { include: animeInclude } },
                // Most-watched first, so "Known for" is the show people know.
                orderBy: { anime: { members: { sort: 'desc', nulls: 'last' } } },
              },
            },
          });

          return rows.flatMap((studio) => {
            const name = sanitizePublicEntityName(studio.adminOverrideName || studio.name);
            if (!studio.slug || !isCleanText(name)) return [];
            const knownFor = uniqueById(studio.animeStudios.map((item) => mapAnime(item.anime))).slice(0, 3);
            if (knownFor.length === 0) return [];
            return [{
              id: studio.id,
              slug: studio.slug,
              name,
              description: studio.adminOverrideDescription || studio.shortDescription || studio.about || '',
              imageUrl: studio.adminOverrideImageUrl || studio.imageUrl || studio.bannerUrl || null,
              /** The logo alone (imageUrl above falls back to the banner). */
              logoUrl: studio.adminOverrideImageUrl || studio.imageUrl || null,
              nativeName: studio.nativeName || null,
              foundedYear: studio.adminOverrideFoundedYear ?? studio.foundedYear ?? null,
              city: studio.city || null,
              closed: studio.status === 'CLOSED' || studio.status === 'INACTIVE',
              knownFor,
              projectCount: studio._count.animeStudios,
            }];
          }).slice(0, 4);
        }),

        // 8. Creators: the people who make the shows — directors, original
        //    creators, writers, designers, composers — ranked by how many of
        //    those creative credits they have (not sound/dub/production staff).
        section([], async () => {
          const ranked = await prisma.$queryRaw<{ id: string; titles: bigint }[]>`
            SELECT p.id, COUNT(DISTINCT s."animeId") AS titles FROM "Person" p
            JOIN "AnimeStaff" s ON s."personId" = p.id
            WHERE p.slug IS NOT NULL AND p."imageUrl" IS NOT NULL AND s.role = ANY(${CREATIVE_ROLES})
            GROUP BY p.id
            ORDER BY COUNT(DISTINCT s."animeId") DESC
            LIMIT 60`;
          if (ranked.length === 0) return [];
          const rows = await prisma.person.findMany({
            where: { id: { in: ranked.map((r) => r.id) } },
            include: {
              staffRoles: {
                where: { role: { in: CREATIVE_ROLES } },
                include: { anime: { include: animeInclude } },
                orderBy: { anime: { members: { sort: 'desc', nulls: 'last' } } },
                take: 12,
              },
            },
          });
          const order = new Map(ranked.map((r, i) => [r.id, i]));
          // How many titles each person has a creative credit on (catalog only).
          const titleCounts = new Map(ranked.map((r) => [r.id, Number(r.titles)]));
          rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

          // A mix of crafts: at most CREATORS_PER_ROLE people per main role, so
          // composers (who score far more credits) don't crowd out directors.
          const perRole = new Map<string, number>();
          return rows.flatMap((person) => {
            const name = sanitizePublicEntityName(person.name);
            if (!person.slug || !isCleanText(name)) return [];
            // Their most frequent creative roles first.
            const counts = new Map<string, number>();
            for (const r of person.staffRoles) counts.set(r.role, (counts.get(r.role) ?? 0) + 1);
            const roles = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([role]) => role);
            const knownFor = uniqueById(person.staffRoles.map((role) => mapAnime(role.anime))).slice(0, 3);
            if (roles.length === 0 || knownFor.length === 0) return [];
            const used = perRole.get(roles[0]) ?? 0;
            if (used >= CREATORS_PER_ROLE) return [];
            perRole.set(roles[0], used + 1);
            return [{
              id: person.id,
              slug: person.slug,
              name,
              role: roles.slice(0, 2).join(' / '),
              about: person.about || '',
              imageUrl: person.imageUrl,
              knownFor,
              titleCount: titleCounts.get(person.id) ?? knownFor.length,
            }];
          }).slice(0, 12);
        }),

        // 9. News
        section([], async () => {
          const rows = await prisma.newsArticle.findMany({
            where: {
              status: 'PUBLISHED',
              moderationState: 'APPROVED',
              deletedAt: null,
              publishedAt: { lte: now },
            },
            orderBy: { publishedAt: 'desc' },
            take: 5,
          });

          return rows.flatMap((article) => {
            const title = sanitizePublicEntityName(article.adminOverrideTitle || article.title);
            if (!article.slug || !isCleanText(title)) return [];
            return [{
              id: article.id,
              slug: article.slug,
              title,
              summary: article.adminOverrideSummary || article.summary || article.subtitle || '',
              imageUrl: article.imageUrl || null,
              source: article.sourceName,
              date: article.publishedAt.toISOString(),
              category: article.adminOverrideCategory || article.category,
              readTime: estimateReadTime(article.content),
            }];
          });
        }),

        // 10. Community
        section({ discussions: [], communities: [] }, async () => {
          const [discussions, communities] = await Promise.all([
            prisma.discussion.findMany({
              // Same visibility rule as everywhere else: never private-community threads on a public page.
              where: { status: { in: ['ACTIVE', 'PINNED'] }, AND: [readableDiscussionsFilter(null)] },
              orderBy: [{ helpfulCount: 'desc' }, { replyCount: 'desc' }, { createdAt: 'desc' }],
              take: 4,
              include: { community: true, author: { select: { username: true } } },
            }),
            prisma.community.findMany({
              where: { status: 'ACTIVE', visibility: 'PUBLIC', deletedAt: null },
              orderBy: [{ memberCount: 'desc' }, { updatedAt: 'desc' }],
              take: 3,
            }),
          ]);

          return {
            discussions: discussions.flatMap((discussion) => {
              const title = sanitizePublicEntityName(discussion.title);
              if (!isCleanText(title)) return [];
              return [{
                id: discussion.id,
                title,
                slug: discussion.id,
                replies: discussion.replyCount,
                excerpt: toExcerpt(discussion.body),
                username: (discussion as any).author?.username || null,
                contentType: 'Discussion',
                communityName: discussion.community ? sanitizePublicEntityName(discussion.community.name) : null,
                communitySlug: discussion.community?.slug || null,
              }];
            }),
            communities: communities.flatMap((community) => {
              const name = sanitizePublicEntityName(community.name);
              if (!isCleanText(name)) return [];
              return [{
                id: community.id,
                slug: community.slug,
                name,
                description: community.description,
                memberCount: community.memberCount,
                iconUrl: community.iconUrl,
              }];
            }),
          };
        }),

        // 11. Recommendations
        section([], async () => uniqueById((await prisma.anime.findMany({
          where: {
            status: { not: 'MERGED' }, isAdult: false,
            posterUrl: { not: '' },
            OR: [{ year: { gte: now.getFullYear() - 1 } }, { score: { gte: 8 } }],
          },
          orderBy: [{ updatedAt: 'desc' }, { score: { sort: 'desc', nulls: 'last' } }],
          take: 10,
          include: animeInclude,
        })).map(mapAnime)).slice(0, 8)),
      ]);

    return { hero, trending, topRated, airing, releaseSchedule, editorsPicks, studios, creators, news, community, recommendations };
  },
  ['home-public-sections'],
  { revalidate: 60, tags: [HOME_SECTIONS_CACHE_TAG] }
);

async function getContinueWatchingSection(authUser: AuthenticatedUser | null) {
  return section([] as any[], async () => {
    if (!authUser) return [];
    const rows = await prisma.userAnime.findMany({
      where: { userId: authUser.id, status: 'WATCHING' },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      include: { anime: { include: animeInclude } },
    });

    return rows.flatMap((row) => {
      const anime = mapAnime(row.anime);
      if (!anime) return [];
      return [{
        id: row.id,
        anime,
        episodesWatched: row.episodesWatched,
        totalEpisodes: row.anime.episodes,
        updatedAt: row.updatedAt.toISOString(),
      }];
    });
  });
}

/** What the signed-in user is tracking (any library status, most recently
 *  updated first), each with the names of their own lists it's in — the
 *  homepage's "You are tracking" row. */
async function getTrackingSection(authUser: AuthenticatedUser | null) {
  return section([] as any[], async () => {
    if (!authUser) return [];
    const rows = await prisma.userAnime.findMany({
      where: { userId: authUser.id, anime: { status: { not: 'MERGED' } } },
      orderBy: { updatedAt: 'desc' },
      take: 14,
      include: { anime: { include: animeInclude } },
    });
    const animeIds = rows.map((r) => r.animeId);
    const memberships = animeIds.length
      ? await prisma.userListItem.findMany({
          where: { animeId: { in: animeIds }, list: { userId: authUser.id } },
          select: { animeId: true, list: { select: { id: true, name: true } } },
          orderBy: { addedAt: 'asc' },
        })
      : [];
    const listsByAnime = new Map<string, { id: string; name: string }[]>();
    for (const m of memberships) {
      const arr = listsByAnime.get(m.animeId) ?? [];
      arr.push(m.list);
      listsByAnime.set(m.animeId, arr);
    }
    return rows.flatMap((row) => {
      const anime = mapAnime(row.anime);
      if (!anime) return [];
      return [{
        id: row.id,
        anime,
        status: row.status,
        episodesWatched: row.episodesWatched,
        totalEpisodes: row.anime.episodes,
        lists: listsByAnime.get(row.animeId) ?? [],
        updatedAt: row.updatedAt.toISOString(),
      }];
    });
  });
}

/** Shared by `/api/home`'s GET handler and the homepage server component —
 *  call this directly from a server component instead of self-fetching
 *  `/api/home` over HTTP. */
export async function getHomeData(authUser: AuthenticatedUser | null) {
  ensureFreshNews();
  ensureFreshSchedule();
  ensureHypePremiereNotifications();
  const [publicSections, continueWatching, tracking, frontPage] = await Promise.all([
    getPublicHomeSections(),
    getContinueWatchingSection(authUser),
    getTrackingSection(authUser),
    getFrontPageSections().catch((error) => {
      console.error('Home front page failed:', error?.message || error);
      return null;
    }),
  ]);
  const { hero, trending, topRated, airing, releaseSchedule, editorsPicks, studios, creators, news, community, recommendations } = publicSections;

  return {
    generatedAt: new Date().toISOString(),
    isAuthenticated: Boolean(authUser),
    sections: {
      hero: hero.data,
      trending: trending.data,
      continueWatching: continueWatching.data,
      tracking: tracking.data,
      airing: airing.data,
      releaseSchedule: releaseSchedule.data,
      topRated: topRated.data,
      editorsPicks: editorsPicks.data,
      studios: studios.data,
      creators: creators.data,
      news: news.data,
      community: community.data,
      recommendations: recommendations.data,
      /** Front-page modules (2026-10-19 redesign); null if they failed to load. */
      frontPage,
    },
    errors: {
      hero: hero.error,
      trending: trending.error,
      continueWatching: continueWatching.error,
      tracking: tracking.error,
      airing: airing.error,
      releaseSchedule: releaseSchedule.error,
      topRated: topRated.error,
      editorsPicks: editorsPicks.error,
      studios: studios.error,
      creators: creators.error,
      news: news.error,
      community: community.error,
      recommendations: recommendations.error,
    },
  };
}

/** "3 min read" from the stored article text, or null when there is none to measure. */
function estimateReadTime(content: string | null | undefined): string | null {
  const words = content ? content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length : 0;
  if (words < 40) return null;
  return `${Math.max(1, Math.round(words / 230))} min read`;
}

/** First ~160 characters of a post, tags and markdown markers stripped; null when empty. */
function toExcerpt(body: string | null | undefined): string | null {
  if (!body) return null;
  const text = body.replace(/<[^>]+>/g, ' ').replace(/[#*_>`~\[\]]/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}
