import { prisma } from './prisma';
import { getAnimeDisplayTitle } from './animeTitleResolver';
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
  scoredBy?: number | null;
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

  // Resolve the MAL id from the canonical row only. It was previously also
  // read from bundled sample data and then persisted below — writing a
  // fixture-derived external id onto a canonical row with no provenance.
  const resolvedMalId = anime.malId || (anime.externalSource === 'mal' && anime.externalId && !isNaN(Number(anime.externalId)) ? Number(anime.externalId) : null);

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
    // External (provider) score and its rating count. OTAKUVA's own score is
    // served separately by /api/anime/:id/rating-summary.
    score: anime.score,
    scoredBy: anime.scoredBy ?? null,
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
  const targetMalId =
    anime?.malId ||
    (anime?.externalSource === 'mal' && anime?.externalId && !isNaN(Number(anime.externalId)) ? Number(anime.externalId) : null);

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

  const targetMalId =
    anime?.malId ||
    (anime?.externalSource === 'mal' && anime?.externalId && !isNaN(Number(anime.externalId)) ? Number(anime.externalId) : null);

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

  const targetMalId =
    anime?.malId ||
    (anime?.externalSource === 'mal' && anime?.externalId && !isNaN(Number(anime.externalId)) ? Number(anime.externalId) : null);

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

// Stored relations point one way; read from the other side they are the
// inverse relationship (the prequel of a sequel), not "Inverted Sequel".
const INVERSE_RELATION: Record<string, string> = {
  Sequel: 'Prequel',
  Prequel: 'Sequel',
  'Side story': 'Parent story',
  'Parent story': 'Side story',
  Summary: 'Full story',
  'Full story': 'Summary',
};

function toRelatedAnime(target: { id: string; slug: string; posterUrl: string; type: string; year: number | null } & Parameters<typeof getAnimeDisplayTitle>[0]) {
  const t = getAnimeDisplayTitle(target);
  return {
    id: target.id,
    slug: target.slug,
    title: t,
    canonicalTitle: t,
    posterImage: target.posterUrl || null,
    type: target.type,
    year: target.year ?? null,
  };
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
    results.push({ relationType: r.relationType, relatedAnime: toRelatedAnime(r.targetAnime) });
  });
  relationsTo.forEach((r) => {
    results.push({
      relationType: INVERSE_RELATION[r.relationType] || r.relationType,
      relatedAnime: toRelatedAnime(r.sourceAnime),
    });
  });

  if (results.length > 0) return results;

  // No stored relations yet: ask the provider, but only keep entries that
  // resolve to an anime already in the canonical catalog. Unresolved entries
  // used to be emitted with made-up "mal-123" slugs (dead links), a stock
  // photo poster and type "TV".
  const anime = await prisma.anime.findUnique({
    where: { id: animeId },
    select: { malId: true },
  });
  if (!anime?.malId) return [];

  const jikanRel = await getJikanAnimeRelations(anime.malId);
  const malIds = jikanRel.map((r) => r.malId).filter((id): id is number => typeof id === 'number');
  if (malIds.length === 0) return [];

  const known = await prisma.anime.findMany({ where: { malId: { in: malIds } } });
  const byMalId = new Map(known.map((a) => [a.malId, a]));

  return jikanRel
    .filter((r) => byMalId.has(r.malId))
    .map((r) => ({ relationType: r.relationType, relatedAnime: toRelatedAnime(byMalId.get(r.malId)!) }));
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

  // Provider figures and OTAKUVA's own aggregate are reported separately and
  // never substituted for one another. The watch-status breakdown used to be
  // invented as fixed shares of members (40% watching, 50% completed, ...),
  // defaulting members to 1,000; it is now the provider's recorded
  // breakdown, or null when none has been captured.
  const ext = anime.externalStats;
  // A stats row can exist with every status count at 0 (captured before the
  // provider reported them); that is no breakdown, not a breakdown of zeros.
  const hasBreakdown = Boolean(ext && ext.watching + ext.completed + ext.onHold + ext.dropped + ext.planToWatch > 0);

  return {
    score: anime.score ?? null,
    scoredBy: anime.scoredBy ?? null,
    rank: anime.rank,
    popularity: anime.popularity,
    members: anime.members ?? null,
    favorites: anime.favoritesCount ?? null,
    watching: hasBreakdown ? ext!.watching : null,
    completed: hasBreakdown ? ext!.completed : null,
    onHold: hasBreakdown ? ext!.onHold : null,
    dropped: hasBreakdown ? ext!.dropped : null,
    planToWatch: hasBreakdown ? ext!.planToWatch : null,
    breakdownCapturedAt: hasBreakdown ? ext!.capturedAt.toISOString() : null,
    otakuva: anime.ratingAggregate
      ? {
          score: anime.ratingAggregate.bayesianScore,
          ratingCount: anime.ratingAggregate.ratingCount,
          confidence: anime.ratingAggregate.confidence,
        }
      : null,
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
