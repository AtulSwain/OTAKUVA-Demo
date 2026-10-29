import { prisma } from '../prisma';
import { sanitizePublicEntityName } from '../normalizers';
import { formatAnimeStatus } from './animeStatus';

/**
 * Everything we hold about one anime that the detail page didn't show:
 * alternative titles, exact air dates, broadcast slot, themes, AniList tags,
 * producers, background notes, provider stats and outbound links.
 *
 * Only stored values — a missing field is omitted, never filled in.
 * Provider figures are labelled with their provider; they are never mixed
 * with OTAKUVA's own member score.
 */

export interface AnimeFacts {
  titles: { english: string[]; japanese: string[]; romaji: string[]; synonyms: string[] };
  release: {
    type: string | null;
    episodes: number | null;
    duration: string | null;
    status: string | null;
    airedFrom: string | null;
    airedTo: string | null;
    datePrecision: string | null;
    season: string | null;
    seasonYear: number | null;
    broadcast: { day: string | null; time: string | null; timezone: string | null } | null;
    nextEpisode: { number: number; at: string } | null;
    source: string | null;
    country: string | null;
    ageRating: string | null;
  };
  studios: { name: string; slug: string | null; role: string }[];
  producers: { name: string; slug: string | null }[];
  themes: { name: string; slug: string }[];
  tags: { name: string; description: string | null; rank: number | null; isSpoiler: boolean }[];
  background: string | null;
  stats: {
    provider: 'MyAnimeList' | 'AniList';
    score: number | null;
    scoredBy: number | null;
    rank: number | null;
    /** MAL: popularity rank (#N). AniList: number of users with it on their list. */
    popularity: number | null;
    popularityIsRank: boolean;
    members: number | null;
    favorites: number | null;
  } | null;
  links: { label: string; url: string }[];
  /** OTAKUVA's own members (2026-10-25): real counts from our tables. */
  community: {
    /** Members with it in their library (any status). */
    inLibraries: number;
    /** Members who favourited it. */
    favorites: number;
    /** Members who gave it a 1–10 rating. */
    ratings: number;
    /** Members who rated at least one of its episodes (retention). */
    retentionRaters: number;
  };
}

const COUNTRY_NAMES: Record<string, string> = { JP: 'Japan', CN: 'China', KR: 'South Korea', TW: 'Taiwan', US: 'United States' };

function uniq(list: string[]) {
  return Array.from(new Set(list.map((s) => s.trim()).filter(Boolean)));
}

async function communityCounts(animeId: string): Promise<AnimeFacts['community']> {
  const [inLibraries, favRows, libFavRows, ratings, raters] = await Promise.all([
    prisma.userAnime.count({ where: { animeId } }),
    prisma.favorite.findMany({ where: { animeId }, select: { userId: true } }),
    prisma.userAnime.findMany({ where: { animeId, favorite: true }, select: { userId: true } }),
    prisma.animeRating.count({ where: { animeId, deletedAt: null } }),
    prisma.episodeRating.groupBy({ by: ['userId'], where: { animeId, episodeNumber: { not: null }, retention: { gte: 1, lte: 100 } } }),
  ]);
  // A favourite can live in either table; each member counts once.
  const favorites = new Set([...favRows, ...libFavRows].map((r) => r.userId)).size;
  return { inLibraries, favorites, ratings, retentionRaters: raters.length };
}

export async function getAnimeFacts(animeId: string): Promise<AnimeFacts | null> {
  const a = await prisma.anime.findUnique({
    where: { id: animeId },
    select: {
      canonicalTitle: true,
      externalSource: true,
      malId: true,
      anilistId: true,
      type: true,
      episodes: true,
      duration: true,
      status: true,
      airedFrom: true,
      airedTo: true,
      startDate: true,
      endDate: true,
      datePrecision: true,
      season: true,
      seasonYear: true,
      broadcastDay: true,
      broadcastTime: true,
      broadcastTimezone: true,
      nextAiringEpisode: true,
      nextAiringAt: true,
      source: true,
      country: true,
      rating: true,
      background: true,
      score: true,
      scoredBy: true,
      rank: true,
      popularity: true,
      members: true,
      favoritesCount: true,
      titles: { select: { type: true, title: true } },
      animeThemes: { select: { theme: { select: { name: true, slug: true } } } },
      animeTags: { select: { name: true, description: true, rank: true, isMediaSpoiler: true }, orderBy: { rank: 'desc' } },
      animeProducers: { select: { producer: { select: { name: true, slug: true } } } },
      animeStudios: { select: { role: true, isPrimary: true, studio: { select: { name: true, slug: true } } } },
      externalIds: { select: { provider: true, externalId: true } },
    },
  });
  if (!a) return null;

  const byType = (...types: string[]) =>
    uniq(a.titles.filter((t) => types.includes(t.type)).map((t) => t.title)).filter(
      (t) => t.toLowerCase() !== a.canonicalTitle.toLowerCase()
    );

  // Which provider the stats came from. MAL data carries a member count;
  // AniList-only imports store AniList's averageScore/popularity instead.
  const fromMal = a.externalSource !== 'anilist' || (a.members ?? 0) > 0;
  const hasStats = [a.score, a.rank, a.popularity, a.members, a.favoritesCount].some((v) => typeof v === 'number' && v > 0);

  const malId = a.malId ?? Number(a.externalIds.find((e) => e.provider === 'mal' || e.provider === 'jikan')?.externalId) ?? null;
  const anilistId = a.anilistId ?? Number(a.externalIds.find((e) => e.provider === 'anilist')?.externalId) ?? null;
  const links: AnimeFacts['links'] = [];
  if (malId && Number.isFinite(malId)) links.push({ label: 'MyAnimeList', url: `https://myanimelist.net/anime/${malId}` });
  if (anilistId && Number.isFinite(anilistId)) links.push({ label: 'AniList', url: `https://anilist.co/anime/${anilistId}` });

  const airedFrom = a.airedFrom ?? a.startDate;
  const airedTo = a.airedTo ?? a.endDate;

  const community = await communityCounts(animeId);
  return {
    community,
    titles: {
      english: byType('english'),
      japanese: byType('japanese'),
      romaji: byType('romaji'),
      synonyms: byType('synonym', 'alternative'),
    },
    release: {
      type: a.type && a.type !== 'UNKNOWN' ? a.type.replace(/_/g, ' ') : null,
      episodes: a.episodes ?? null,
      duration: a.duration ?? null,
      status: formatAnimeStatus(a.status),
      airedFrom: airedFrom ? airedFrom.toISOString() : null,
      airedTo: airedTo ? airedTo.toISOString() : null,
      datePrecision: a.datePrecision || null,
      season: a.season ?? null,
      seasonYear: a.seasonYear ?? null,
      broadcast: a.broadcastDay || a.broadcastTime ? { day: a.broadcastDay, time: a.broadcastTime, timezone: a.broadcastTimezone } : null,
      nextEpisode:
        a.nextAiringEpisode && a.nextAiringAt && a.nextAiringAt.getTime() > Date.now()
          ? { number: a.nextAiringEpisode, at: a.nextAiringAt.toISOString() }
          : null,
      source: a.source ?? null,
      country: a.country ? COUNTRY_NAMES[a.country] ?? a.country : null,
      ageRating: a.rating ?? null,
    },
    studios: a.animeStudios
      .map((s) => ({ name: sanitizePublicEntityName(s.studio.name), slug: s.studio.slug ?? null, role: s.role }))
      .filter((s) => s.name),
    producers: a.animeProducers.map((p) => ({ name: sanitizePublicEntityName(p.producer.name), slug: p.producer.slug ?? null })).filter((p) => p.name),
    themes: a.animeThemes.map((t) => t.theme),
    tags: a.animeTags.map((t) => ({ name: t.name, description: t.description, rank: t.rank ?? null, isSpoiler: t.isMediaSpoiler })),
    background: a.background?.trim() || null,
    stats: hasStats
      ? {
          provider: fromMal ? 'MyAnimeList' : 'AniList',
          score: a.score ?? null,
          scoredBy: fromMal ? a.scoredBy ?? null : null,
          rank: fromMal ? a.rank ?? null : null,
          popularity: a.popularity ?? null,
          popularityIsRank: fromMal,
          members: (a.members ?? 0) > 0 ? a.members : null,
          favorites: a.favoritesCount ?? null,
        }
      : null,
    links,
  };
}
