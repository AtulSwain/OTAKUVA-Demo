import { prisma } from './prisma';
import { getAnimeDisplayTitle } from './animeTitleResolver';
import { FIXTURE_ANIMES } from '../fixtures/anime.fixture';
import {
  getJikanAnimeCharacters,
  getJikanAnimeStaff,
  getJikanAnimeEpisodes,
  getJikanAnimeRelations,
} from './jikanService';

export interface AnimeCardData {
  id: string;
  slug: string;
  title: string;
  canonicalTitle?: string;
  englishTitle?: string;
  japaneseTitle?: string;
  posterImage: string;
  score: number | null;
  episodes: number | null;
  status: string;
  type: string;
  year?: number | null;
  season?: string | null;
  genres: string[];
}

export interface AnimeDetailData extends AnimeCardData {
  synopsis: string;
  background?: string | null;
  bannerImage: string;
  duration?: string | null;
  rating?: string | null;
  airedFrom?: string | null;
  airedTo?: string | null;
  broadcast?: {
    day?: string | null;
    time?: string | null;
    timezone?: string | null;
  };
  rank?: number | null;
  popularity?: number | null;
  members?: number;
  favoritesCount?: number;
  studios: string[];
  producers: string[];
  themes: string[];
  titles: { type: string; title: string }[];
  trailerUrl?: string | null;
  source?: string | null;
  malId?: number | null;
}

export async function getAnimeBySlugOrId(slugOrId: string): Promise<AnimeDetailData | null> {
  const anime = await prisma.anime.findFirst({
    where: {
      OR: [{ slug: slugOrId }, { id: slugOrId }],
    },
    include: {
      titles: true,
      animeGenres: { include: { genre: true } },
      animeThemes: { include: { theme: true } },
      animeStudios: { include: { studio: true } },
      animeProducers: { include: { producer: true } },
    },
  });

  if (!anime) return null;

  const displayTitle = getAnimeDisplayTitle(anime);
  const englishTitle = anime.titles.find((t) => t.type === 'english')?.title || displayTitle;
  const japaneseTitle = anime.titles.find((t) => t.type === 'japanese')?.title || '';

  const matchedFixture = FIXTURE_ANIMES.find((a) => a.id === slugOrId || a.slug === slugOrId || a.id === anime.id);
  const resolvedMalId = anime.malId || (anime.externalSource === 'mal' && anime.externalId && !isNaN(Number(anime.externalId)) ? Number(anime.externalId) : null) || (matchedFixture?.externalId && !isNaN(Number(matchedFixture.externalId)) ? Number(matchedFixture.externalId) : null);

  // Backfill malId if missing in DB
  if (!anime.malId && resolvedMalId) {
    prisma.anime.update({ where: { id: anime.id }, data: { malId: resolvedMalId } }).catch(() => {});
  }

  return {
    id: anime.id,
    slug: anime.slug,
    title: displayTitle,
    canonicalTitle: displayTitle,
    englishTitle,
    japaneseTitle,
    synopsis: anime.synopsis,
    background: anime.background,
    posterImage: anime.posterUrl,
    bannerImage: anime.bannerUrl || anime.posterUrl,
    score: anime.score,
    episodes: anime.episodes,
    status: anime.status,
    type: anime.type,
    year: anime.year,
    season: anime.season,
    duration: anime.duration,
    rating: anime.rating,
    airedFrom: anime.airedFrom ? anime.airedFrom.toISOString() : null,
    airedTo: anime.airedTo ? anime.airedTo.toISOString() : null,
    broadcast: {
      day: anime.broadcastDay,
      time: anime.broadcastTime,
      timezone: anime.broadcastTimezone,
    },
    rank: anime.rank,
    popularity: anime.popularity,
    members: anime.members || 0,
    favoritesCount: anime.favoritesCount || 0,
    studios: anime.animeStudios.map((s) => s.studio.name),
    producers: anime.animeProducers.map((p) => p.producer.name),
    genres: anime.animeGenres.map((g) => g.genre.name),
    themes: anime.animeThemes.map((t) => t.theme.name),
    titles: anime.titles.map((t) => ({ type: t.type, title: t.title })),
    trailerUrl: anime.trailerUrl,
    source: anime.source,
    malId: resolvedMalId,
  };
}

export async function getAnimeEpisodesData(animeId: string, page = 1, limit = 50) {
  const skip = (page - 1) * limit;

  // Resolve anime first to guarantee valid anime.id
  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeId }, { slug: animeId }] },
    select: { id: true, malId: true, externalId: true, externalSource: true, episodes: true },
  });

  const targetAnimeId = anime?.id || animeId;

  const [episodes, totalCount] = await Promise.all([
    prisma.episode.findMany({
      where: { animeId: targetAnimeId },
      orderBy: { number: 'asc' },
      skip,
      take: limit,
    }),
    prisma.episode.count({ where: { animeId: targetAnimeId } }),
  ]);

  if (episodes.length > 0) {
    return {
      episodes: episodes.map((ep) => ({
        id: ep.id,
        number: ep.number,
        title: ep.title,
        titleJapanese: ep.titleJapanese,
        synopsis: ep.synopsis,
        duration: ep.duration,
        filler: ep.filler,
        recap: ep.recap,
        airedAt: ep.airedAt ? ep.airedAt.toISOString() : null,
      })),
      pagination: {
        page,
        limit,
        totalEpisodes: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: skip + episodes.length < totalCount,
      },
    };
  }

  // Fallback: Query Jikan API if MAL ID exists
  const matchedFixture = FIXTURE_ANIMES.find((a) => a.id === animeId || a.slug === animeId || a.id === targetAnimeId);
  const targetMalId =
    anime?.malId ||
    (anime?.externalSource === 'mal' && anime?.externalId && !isNaN(Number(anime.externalId)) ? Number(anime.externalId) : null) ||
    (matchedFixture?.externalId && !isNaN(Number(matchedFixture.externalId)) ? Number(matchedFixture.externalId) : null);

  if (targetMalId) {
    const jikanEp = await getJikanAnimeEpisodes(targetMalId, page);
    if (jikanEp.episodes.length > 0) {
      return {
        episodes: jikanEp.episodes,
        pagination: {
          page,
          limit,
          totalEpisodes: anime?.episodes || jikanEp.episodes.length,
          totalPages: jikanEp.lastPage,
          hasNextPage: jikanEp.hasNextPage,
        },
      };
    }
  }

  return {
    episodes: [],
    pagination: {
      page,
      limit,
      totalEpisodes: 0,
      totalPages: 0,
      hasNextPage: false,
    },
  };
}

export async function getAnimeCharactersData(animeId: string) {
  const characters = await prisma.animeCharacter.findMany({
    where: {
      OR: [
        { animeId },
        { anime: { slug: animeId } },
      ],
    },
    include: {
      character: {
        include: {
          voiceRoles: {
            include: { person: true },
          },
        },
      },
    },
  });

  if (characters.length > 0) {
    return characters.map((c) => ({
      id: c.character.id,
      name: c.character.name,
      nameKanji: c.character.nameKanji,
      imageUrl: c.character.imageUrl,
      role: c.role,
      voiceActors: c.character.voiceRoles.map((vr) => ({
        personId: vr.person.id,
        name: vr.person.name,
        nameKanji: vr.person.nameKanji,
        imageUrl: vr.person.imageUrl,
        language: vr.language,
      })),
    }));
  }

  // Fallback: Query Jikan API directly if MAL ID is known
  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeId }, { slug: animeId }] },
    select: { id: true, malId: true, externalId: true, externalSource: true },
  });

  const matchedFixture = FIXTURE_ANIMES.find((a) => a.id === animeId || a.slug === animeId || a.id === anime?.id);
  const targetMalId =
    anime?.malId ||
    (anime?.externalSource === 'mal' && anime?.externalId && !isNaN(Number(anime.externalId)) ? Number(anime.externalId) : null) ||
    (matchedFixture?.externalId && !isNaN(Number(matchedFixture.externalId)) ? Number(matchedFixture.externalId) : null);

  if (targetMalId) {
    if (anime && !anime.malId) {
      prisma.anime.update({ where: { id: anime.id }, data: { malId: targetMalId } }).catch(() => {});
    }

    const jikanChars = await getJikanAnimeCharacters(targetMalId);
    if (jikanChars && jikanChars.length > 0) {
      return jikanChars;
    }
  }

  return [];
}

export async function getAnimeStaffData(animeId: string) {
  const staff = await prisma.animeStaff.findMany({
    where: {
      OR: [
        { animeId },
        { anime: { slug: animeId } },
      ],
    },
    include: { person: true },
  });

  if (staff.length > 0) {
    return staff.map((s) => ({
      id: s.id,
      role: s.role,
      person: {
        id: s.person.id,
        name: s.person.name,
        nameKanji: s.person.nameKanji,
        imageUrl: s.person.imageUrl,
      },
    }));
  }

  // Fallback: Query Jikan API directly if MAL ID is known
  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeId }, { slug: animeId }] },
    select: { id: true, malId: true, externalId: true, externalSource: true },
  });

  const matchedFixture = FIXTURE_ANIMES.find((a) => a.id === animeId || a.slug === animeId || a.id === anime?.id);
  const targetMalId =
    anime?.malId ||
    (anime?.externalSource === 'mal' && anime?.externalId && !isNaN(Number(anime.externalId)) ? Number(anime.externalId) : null) ||
    (matchedFixture?.externalId && !isNaN(Number(matchedFixture.externalId)) ? Number(matchedFixture.externalId) : null);

  if (targetMalId) {
    if (anime && !anime.malId) {
      prisma.anime.update({ where: { id: anime.id }, data: { malId: targetMalId } }).catch(() => {});
    }

    const jikanStaff = await getJikanAnimeStaff(targetMalId);
    if (jikanStaff && jikanStaff.length > 0) {
      return jikanStaff;
    }
  }

  return [];
}

export async function getAnimeRelationsData(animeId: string) {
  const [relationsFrom, relationsTo] = await Promise.all([
    prisma.animeRelation.findMany({
      where: { sourceAnimeId: animeId },
      include: { targetAnime: true },
    }),
    prisma.animeRelation.findMany({
      where: { targetAnimeId: animeId },
      include: { sourceAnime: true },
    }),
  ]);

  const results: any[] = [];
  relationsFrom.forEach((r) => {
    const t = getAnimeDisplayTitle(r.targetAnime);
    results.push({
      relationType: r.relationType,
      relatedAnime: {
        id: r.targetAnime.id,
        slug: r.targetAnime.slug,
        title: t,
        canonicalTitle: t,
        posterImage: r.targetAnime.posterUrl,
        type: r.targetAnime.type,
      },
    });
  });

  relationsTo.forEach((r) => {
    const t = getAnimeDisplayTitle(r.sourceAnime);
    results.push({
      relationType: `Inverted ${r.relationType}`,
      relatedAnime: {
        id: r.sourceAnime.id,
        slug: r.sourceAnime.slug,
        title: t,
        canonicalTitle: t,
        posterImage: r.sourceAnime.posterUrl,
        type: r.sourceAnime.type,
      },
    });
  });

  if (results.length > 0) return results;

  // Fallback: Query Jikan API directly
  const anime = await prisma.anime.findUnique({
    where: { id: animeId },
    select: { malId: true },
  });

  if (anime?.malId) {
    const jikanRel = await getJikanAnimeRelations(anime.malId);
    return jikanRel.map((r) => ({
      relationType: r.relationType,
      relatedAnime: {
        id: `mal-${r.malId}`,
        slug: `mal-${r.malId}`,
        title: r.title,
        canonicalTitle: r.title,
        posterImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600',
        type: 'TV',
      },
    }));
  }

  return [];
}

export async function getAnimeStatisticsData(animeId: string) {
  const anime = await prisma.anime.findUnique({
    where: { id: animeId },
    include: {
      externalStats: true,
      ratingAggregate: true,
    },
  });

  if (!anime) return null;

  return {
    score: anime.score || anime.ratingAggregate?.bayesianScore || anime.ratingAggregate?.rawAverage || 0,
    scoredBy: anime.scoredBy || anime.ratingAggregate?.ratingCount || 0,
    rank: anime.rank,
    popularity: anime.popularity,
    members: anime.members || 0,
    favorites: anime.favoritesCount || 0,
    watching: Math.floor((anime.members || 1000) * 0.4),
    completed: Math.floor((anime.members || 1000) * 0.5),
    onHold: Math.floor((anime.members || 1000) * 0.05),
    dropped: Math.floor((anime.members || 1000) * 0.03),
    planToWatch: Math.floor((anime.members || 1000) * 0.02),
  };
}

export async function getAnimeVideosData(animeId: string) {
  const anime = await prisma.anime.findUnique({
    where: { id: animeId },
    select: { trailerUrl: true, canonicalTitle: true },
  });

  if (!anime) return [];

  const videos: any[] = [];
  if (anime.trailerUrl) {
    videos.push({
      id: `trailer-${animeId}`,
      title: `${anime.canonicalTitle} - Official Trailer`,
      url: anime.trailerUrl,
      type: 'Trailer',
    });
  }

  return videos;
}
