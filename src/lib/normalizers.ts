import crypto from 'crypto';
import {
  ProviderAnime,
  ProviderEpisode,
  ProviderCharacter,
  ProviderStaff,
  ProviderRelation,
  ProviderDate,
} from './providers/animeProvider.interface';

/**
 * Strips internal timestamp suffixes, test tags, and generated UUID markers from public display names
 */
export function sanitizePublicEntityName(rawName: string): string {
  if (!rawName) return '';
  return rawName
    .replace(/[_-\s]*\b\d{10,14}\b[_-\s]*/g, '')
    .replace(/_+\d{10,14}$/g, '')
    .replace(/\s*\(.*test.*\)/gi, '')
    .replace(/\s*\[.*test.*\]/gi, '')
    .replace(/\s*\((?:director|producer|animation|voice\s*actor|sound|author|original\s*creator|writer|staff)\)/gi, '')
    .replace(/\s+test\s+(studio|anime|rec|engine|article)/gi, '')
    .replace(/\s+co\.,\s*ltd\..*$/i, '')
    .replace(/\s+inc\s+dupe.*$/i, '')
    .replace(/\s+dupe.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function normalizeSlug(title: string, externalId?: string): string {
  const sanitized = sanitizePublicEntityName(title);
  const clean = sanitized
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return clean || `anime-${externalId || 'id'}`;
}

export const generateSlug = normalizeSlug;

export function normalizeSearchTitle(term: string): string {
  return term
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeMetadataHash(obj: any): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 32);
}

export function calculateDataCompletenessScore(anime: {
  canonicalTitle?: string | null;
  synopsis?: string | null;
  posterUrl?: string | null;
  bannerUrl?: string | null;
  startDate?: Date | null;
  startYear?: number | null;
  episodes?: number | null;
  type?: string | null;
  status?: string | null;
  genresCount?: number;
  studiosCount?: number;
  charactersCount?: number;
  staffCount?: number;
}): number {
  let score = 0;
  if (anime.canonicalTitle) score += 15;
  if (anime.synopsis && anime.synopsis.length > 30) score += 15;
  if (anime.posterUrl) score += 10;
  if (anime.bannerUrl) score += 5;
  if (anime.startDate || anime.startYear) score += 10;
  if (typeof anime.episodes === 'number' && anime.episodes > 0) score += 10;
  if (anime.type && anime.type !== 'UNKNOWN') score += 5;
  if (anime.status && anime.status !== 'UNKNOWN') score += 5;
  if ((anime.genresCount || 0) > 0) score += 10;
  if ((anime.studiosCount || 0) > 0) score += 5;
  if ((anime.charactersCount || 0) > 0) score += 5;
  if ((anime.staffCount || 0) > 0) score += 5;
  return Math.min(100, score);
}

export function validateAndNormalizeAnime(input: ProviderAnime) {
  if (!input.externalId || !input.title) {
    throw new Error('Anime missing required externalId or title');
  }

  const slug = normalizeSlug(input.title, input.externalId);

  // Validate Score Range 0-10
  let validScore: number | null = null;
  if (typeof input.score === 'number' && !isNaN(input.score) && input.score >= 0 && input.score <= 10) {
    validScore = input.score;
  }

  // Validate episodes count
  let validEpisodes: number | null = null;
  if (typeof input.episodes === 'number' && !isNaN(input.episodes) && input.episodes > 0) {
    validEpisodes = Math.floor(input.episodes);
  }

  // Date Parsing & Precision
  const startDate = input.startDate?.date || null;
  const endDate = input.endDate?.date || null;
  const startYear = input.startDate?.year || input.year || null;
  const startMonth = input.startDate?.month || null;
  const startDay = input.startDate?.day || null;
  const endYear = input.endDate?.year || null;
  const endMonth = input.endDate?.month || null;
  const endDay = input.endDate?.day || null;
  const datePrecision = input.startDate?.precision || (startYear ? 'YEAR' : 'UNKNOWN');

  const normalizedPayload = {
    externalId: String(input.externalId),
    externalSource: input.externalSource || 'anilist',
    malId: input.malId || null,
    anilistId: input.anilistId || (input.externalSource === 'anilist' ? parseInt(input.externalId, 10) : null),
    slug,
    canonicalTitle: input.title.trim(),
    synopsis: input.synopsis ? input.synopsis.trim() : 'No synopsis available.',
    background: input.background ? input.background.trim() : null,
    type: input.type || 'TV',
    source: input.source || null,
    status: input.status || 'Finished',
    country: input.country || 'JP',
    isAdult: Boolean(input.isAdult),
    episodes: validEpisodes,
    duration: input.duration || '24 min',
    rating: input.rating || null,
    airedFrom: startDate,
    airedTo: endDate,
    startDate,
    endDate,
    startYear,
    startMonth,
    startDay,
    endYear,
    endMonth,
    endDay,
    datePrecision,
    season: input.season || null,
    seasonYear: input.year || startYear || null,
    year: input.year || startYear || null,
    broadcastDay: input.broadcastDay || null,
    broadcastTime: input.broadcastTime || null,
    broadcastTimezone: input.broadcastTimezone || null,
    score: validScore,
    scoredBy: typeof input.scoredBy === 'number' ? Math.max(0, input.scoredBy) : 0,
    rank: typeof input.rank === 'number' ? input.rank : null,
    popularity: typeof input.popularity === 'number' ? input.popularity : null,
    members: typeof input.members === 'number' ? input.members : 0,
    favoritesCount: typeof input.favorites === 'number' ? input.favorites : 0,
    posterUrl: input.posterUrl || '',
    largePosterUrl: input.largePosterUrl || input.posterUrl || '',
    bannerUrl: input.bannerUrl || null,
    trailerUrl: input.trailerUrl || null,
  };

  const metadataHash = computeMetadataHash(normalizedPayload);

  return {
    ...normalizedPayload,
    metadataHash,
    genres: Array.isArray(input.genres) ? input.genres.filter(Boolean).map((g) => g.trim()) : [],
    themes: Array.isArray(input.themes) ? input.themes.filter(Boolean).map((t) => t.trim()) : [],
    tags: Array.isArray(input.tags) ? input.tags : [],
    studios: Array.isArray(input.studios) ? input.studios : [],
    producers: Array.isArray(input.producers) ? input.producers.filter(Boolean).map((p) => p.trim()) : [],
    licensors: Array.isArray(input.licensors) ? input.licensors.filter(Boolean).map((l) => l.trim()) : [],
    titles: Array.isArray(input.titles) ? input.titles.filter((t) => t.title && t.title.trim()) : [],
  };
}

export function validateAndNormalizeEpisode(ep: ProviderEpisode, animeId: string) {
  if (typeof ep.number !== 'number' || ep.number < 0) {
    throw new Error(`Invalid episode number for anime ${animeId}: ${ep.number}`);
  }

  let airedAt: Date | null = null;
  if (ep.airedAt) {
    const d = new Date(ep.airedAt);
    if (!isNaN(d.getTime())) airedAt = d;
  }

  return {
    animeId,
    externalId: ep.externalId || String(ep.number),
    number: ep.number,
    title: ep.title ? ep.title.trim() : `Episode ${ep.number}`,
    titleJapanese: ep.titleJapanese ? ep.titleJapanese.trim() : null,
    synopsis: ep.synopsis ? ep.synopsis.trim() : null,
    airedAt,
    duration: ep.duration || '24 min',
    filler: Boolean(ep.filler),
    recap: Boolean(ep.recap),
    imageUrl: ep.imageUrl || null,
    externalUrl: ep.externalUrl || null,
  };
}
