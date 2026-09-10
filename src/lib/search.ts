import { prisma } from './prisma';
import { AnimeCardData } from './animeData';
import { normalizeSearchTitle } from './normalizers';
import { getAnimeDisplayTitle } from './animeTitleResolver';

export interface SearchFilters {
  query?: string;
  genre?: string;
  theme?: string;
  tag?: string;
  studio?: string;
  type?: string;
  status?: string;
  season?: string;
  year?: number;
  decade?: string; // "1900s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"
  minScore?: number;
  maxScore?: number;
  sortBy?: 'score' | 'popularity' | 'title' | 'rank' | 'year' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export async function searchCatalog(filters: SearchFilters): Promise<{
  items: AnimeCardData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}> {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 24));
  const skip = (page - 1) * limit;

  const where: any = {
    status: { not: 'MERGED' },
  };

  // Multi-field search against title, slug, alternate titles, studio, genres, and tags
  if (filters.query && filters.query.trim()) {
    const rawTerm = filters.query.trim();
    const normalizedTerm = normalizeSearchTitle(rawTerm);

    where.OR = [
      { canonicalTitle: { contains: rawTerm } },
      { slug: { contains: normalizedTerm } },
      { titles: { some: { searchableTitle: { contains: normalizedTerm } } } },
      { titles: { some: { title: { contains: rawTerm } } } },
      { animeStudios: { some: { studio: { name: { contains: rawTerm } } } } },
      { animeGenres: { some: { genre: { name: { contains: rawTerm } } } } },
      { animeTags: { some: { name: { contains: rawTerm } } } },
    ];
  }

  // Genre filter
  if (filters.genre && filters.genre !== 'All') {
    where.animeGenres = {
      some: {
        genre: { name: { contains: filters.genre } },
      },
    };
  }

  // Theme filter
  if (filters.theme && filters.theme !== 'All') {
    where.animeThemes = {
      some: {
        theme: { name: { contains: filters.theme } },
      },
    };
  }

  // Tag filter
  if (filters.tag && filters.tag !== 'All') {
    where.animeTags = {
      some: {
        name: { contains: filters.tag },
      },
    };
  }

  // Studio filter
  if (filters.studio && filters.studio !== 'All') {
    where.animeStudios = {
      some: {
        studio: { name: { contains: filters.studio } },
      },
    };
  }

  // Type filter
  if (filters.type && filters.type !== 'All') {
    const tLower = filters.type.toLowerCase();
    let typeVariants = [filters.type];
    if (tLower === 'tv') typeVariants = ['TV', 'TV_SHORT', 'tv'];
    else if (tLower === 'movie') typeVariants = ['Movie', 'MOVIE', 'movie'];
    else if (tLower === 'ona') typeVariants = ['ONA', 'ona'];
    else if (tLower === 'ova') typeVariants = ['OVA', 'ova'];
    else if (tLower === 'special') typeVariants = ['Special', 'SPECIAL', 'special'];

    where.type = { in: typeVariants };
  }

  // Status filter
  if (filters.status && filters.status !== 'All') {
    const sLower = filters.status.toLowerCase();
    let statusVariants = [filters.status];
    if (sLower.includes('finish') || sLower.includes('complete')) {
      statusVariants = ['Finished', 'FINISHED', 'Completed', 'COMPLETED'];
    } else if (sLower.includes('air')) {
      statusVariants = ['Airing', 'CURRENTLY_AIRING', 'AIRING', 'Currently Airing'];
    } else if (sLower.includes('not') || sLower.includes('upcom')) {
      statusVariants = ['NOT_YET_AIRED', 'UPCOMING', 'Not Yet Aired', 'Upcoming', 'Not yet aired'];
    }

    where.status = { in: statusVariants };
  }

  // Season & Year filter
  if (filters.season && filters.season !== 'All') {
    where.OR = [
      { season: { equals: filters.season } },
      { season: { equals: filters.season.toUpperCase() } },
      { season: { equals: filters.season.toLowerCase() } },
    ];
  }
  if (filters.year) {
    where.OR = [
      { year: filters.year },
      { startYear: filters.year },
    ];
  }

  // Decade Filter (e.g. 1970s => 1970 - 1979)
  if (filters.decade && filters.decade !== 'All') {
    const startYear = parseInt(filters.decade.replace(/s$/, ''), 10);
    if (!isNaN(startYear)) {
      const endYear = startYear + 9;
      where.OR = [
        { year: { gte: startYear, lte: endYear } },
        { startYear: { gte: startYear, lte: endYear } },
      ];
    }
  }

  // Score bounds
  if (filters.minScore !== undefined || filters.maxScore !== undefined) {
    where.score = {};
    if (filters.minScore !== undefined) where.score.gte = filters.minScore;
    if (filters.maxScore !== undefined) where.score.lte = filters.maxScore;
  }

  // Order By Strategy
  let orderBy: any = {};
  const sortDirection = filters.sortOrder || 'desc';

  switch (filters.sortBy) {
    case 'popularity':
      orderBy = { popularity: sortDirection === 'desc' ? 'desc' : 'asc' };
      break;
    case 'title':
      orderBy = { canonicalTitle: sortDirection };
      break;
    case 'rank':
      orderBy = { rank: sortDirection === 'desc' ? 'desc' : 'asc' };
      break;
    case 'year':
      orderBy = [{ year: sortDirection }, { startYear: sortDirection }];
      break;
    case 'updatedAt':
      orderBy = { updatedAt: sortDirection };
      break;
    case 'score':
    default:
      orderBy = [{ score: sortDirection }, { popularity: 'desc' }];
      break;
  }

  const [total, records] = await Promise.all([
    prisma.anime.count({ where }),
    prisma.anime.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        animeGenres: { include: { genre: true } },
        animeStudios: { include: { studio: true } },
        titles: true,
      },
    }),
  ]);

  const items: AnimeCardData[] = records.map((r) => {
    const displayTitle = getAnimeDisplayTitle(r);
    return {
      id: r.id,
      externalId: r.externalId || r.id,
      externalSource: r.externalSource,
      malId: r.malId,
      anilistId: r.anilistId,
      slug: r.slug,
      title: displayTitle,
      canonicalTitle: displayTitle,
      englishTitle: r.titles.find((t) => t.type === 'english')?.title || undefined,
      japaneseTitle: r.titles.find((t) => t.type === 'japanese')?.title || undefined,
      posterImage: r.posterUrl,
      synopsis: r.synopsis,
      type: r.type,
      status: r.status,
      episodes: r.episodes,
      score: r.score,
      scoredBy: r.scoredBy,
      rank: r.rank,
      popularity: r.popularity,
      members: r.members,
      posterUrl: r.posterUrl,
      largePosterUrl: r.largePosterUrl,
      bannerUrl: r.bannerUrl,
      trailerUrl: r.trailerUrl,
      season: r.season,
      year: r.year || r.startYear,
      startDate: r.startDate ? r.startDate.toISOString() : null,
      datePrecision: r.datePrecision,
      nextAiringEpisode: r.nextAiringEpisode,
      nextAiringAt: r.nextAiringAt ? r.nextAiringAt.toISOString() : null,
      timeUntilAiring: r.timeUntilAiring,
      genres: r.animeGenres.map((ag) => ag.genre.name),
      studios: r.animeStudios.map((as) => as.studio.name),
    };
  });

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
    },
  };
}
