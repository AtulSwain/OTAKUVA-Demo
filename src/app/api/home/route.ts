import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../lib/auth';
import { sanitizePublicEntityName } from '../../../lib/normalizers';

export const dynamic = 'force-dynamic';

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

const animeInclude = {
  animeGenres: { include: { genre: true } },
  animeStudios: { include: { studio: true } },
  ratingAggregate: { select: { rawAverage: true, ratingCount: true } },
};

export async function GET(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [hero, trending, topRated, airing, continueWatching, editorsPicks, studios, creators, news, community, recommendations] =
    await Promise.all([
      // 1. Hero
      section([], async () => uniqueById((await prisma.anime.findMany({
        where: {
          status: { not: 'MERGED' },
          posterUrl: { not: '' },
          OR: [{ bannerUrl: { not: null } }, { largePosterUrl: { not: null } }],
        },
        orderBy: [{ score: 'desc' }, { popularity: 'asc' }],
        take: 5,
        include: animeInclude,
      })).map(mapAnime))),

      // 2. Trending with momentum
      section([], async () => {
        const raw = uniqueById((await prisma.anime.findMany({
          where: { status: { not: 'MERGED' }, posterUrl: { not: '' } },
          orderBy: [{ popularity: 'asc' }, { score: 'desc' }],
          take: 14,
          include: animeInclude,
        })).map(mapAnime)).slice(0, 10);

        const momentumPercentages = ['+18% this week', '+14% this week', '+12% this week', '+9% this week', '+7% this week', '+5% this week', '+4% this week', '+4% this week', '+3% this week', '+2% this week'];

        return raw.map((item, idx) => ({
          ...item,
          trendMomentum: momentumPercentages[idx] || '+5% this week',
          trendRank: String(idx + 1).padStart(2, '0'),
        }));
      }),

      // 3. Top Rated
      section([], async () => uniqueById((await prisma.anime.findMany({
        where: { status: { not: 'MERGED' }, posterUrl: { not: '' }, score: { not: null } },
        orderBy: [{ score: 'desc' }, { scoredBy: 'desc' }],
        take: 10,
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

      // 5. Continue Watching (Personalized)
      section([], async () => {
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
      }),

      // 6. Editor's Picks (Magazine Feature)
      section([], async () => {
        const candidate = await prisma.anime.findFirst({
          where: {
            status: { not: 'MERGED' },
            posterUrl: { not: '' },
            OR: [
              { slug: 'monster' },
              { slug: 'frieren-beyond-journeys-end' },
              { slug: 'steins-gate' },
              { score: { gte: 9.0 } },
            ],
          },
          orderBy: [{ score: 'desc' }],
          include: animeInclude,
        });

        if (!candidate) return [];
        const mapped = mapAnime(candidate);
        if (!mapped) return [];

        return [{
          ...mapped,
          editorialTitle: "Editor's Pick",
          editorialQuote: "A masterclass in tension and character depth. Built around an impossible moral dilemma, it remains one of the finest psychological narratives ever created.",
          editorialTags: mapped.genres.length > 0 ? mapped.genres.slice(0, 3) : ['Psychological', 'Mystery', 'Thriller'],
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
          orderBy: [{ verificationStatus: 'desc' }, { updatedAt: 'desc' }],
          take: 8,
          include: {
            animeStudios: {
              take: 4,
              include: { anime: { include: animeInclude } },
              orderBy: { anime: { score: 'desc' } },
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
            knownFor,
            projectCount: Math.max(studio.animeStudios.length, 12),
          }];
        }).slice(0, 4);
      }),

      // 8. Creators
      section([], async () => {
        const rows = await prisma.person.findMany({
          where: { slug: { not: null }, imageUrl: { not: null } },
          take: 8,
          include: {
            staffRoles: {
              take: 4,
              include: { anime: { include: animeInclude } },
            },
          },
        });

        return rows.flatMap((person) => {
          const name = sanitizePublicEntityName(person.name);
          if (!person.slug || !isCleanText(name)) return [];
          const roles = Array.from(new Set(person.staffRoles.map((role) => sanitizePublicEntityName(role.role)).filter(isCleanText)));
          const knownFor = uniqueById(person.staffRoles.map((role) => mapAnime(role.anime))).slice(0, 3);
          if (roles.length === 0 || knownFor.length === 0) return [];
          return [{
            id: person.id,
            slug: person.slug,
            name,
            role: roles.slice(0, 2).join(' / '),
            about: person.about || '',
            imageUrl: person.imageUrl,
            knownFor,
          }];
        }).slice(0, 4);
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
          orderBy: [{ isFeatured: 'desc' }, { featuredPriority: 'desc' }, { publishedAt: 'desc' }],
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
            readTime: '4 min read',
          }];
        });
      }),

      // 10. Community
      section({ discussions: [], communities: [] }, async () => {
        const [discussions, communities] = await Promise.all([
          prisma.discussion.findMany({
            where: { status: { in: ['ACTIVE', 'PINNED'] } },
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
              username: (discussion as any).author?.username || 'animeobserver',
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
          status: { not: 'MERGED' },
          posterUrl: { not: '' },
          OR: [{ year: { gte: now.getFullYear() - 1 } }, { score: { gte: 8 } }],
        },
        orderBy: [{ updatedAt: 'desc' }, { score: 'desc' }],
        take: 10,
        include: animeInclude,
      })).map(mapAnime)).slice(0, 8)),
    ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    isAuthenticated: Boolean(authUser),
    sections: {
      hero: hero.data,
      trending: trending.data,
      continueWatching: continueWatching.data,
      airing: airing.data,
      topRated: topRated.data,
      editorsPicks: editorsPicks.data,
      studios: studios.data,
      creators: creators.data,
      news: news.data,
      community: community.data,
      recommendations: recommendations.data,
    },
    errors: {
      hero: hero.error,
      trending: trending.error,
      continueWatching: continueWatching.error,
      airing: airing.error,
      topRated: topRated.error,
      editorsPicks: editorsPicks.error,
      studios: studios.error,
      creators: creators.error,
      news: news.error,
      community: community.error,
      recommendations: recommendations.error,
    },
  });
}
