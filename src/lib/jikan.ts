export interface JikanAnime {
  mal_id: number;
  url: string;
  images: {
    jpg: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
    webp?: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
  };
  trailer?: {
    youtube_id?: string;
    url?: string;
    embed_url?: string;
  };
  title: string;
  title_english?: string;
  title_japanese?: string;
  title_synonyms?: string[];
  type?: string;
  source?: string;
  episodes?: number;
  status?: string;
  airing?: boolean;
  aired?: {
    from?: string;
    to?: string;
    string?: string;
  };
  duration?: string;
  rating?: string;
  score?: number;
  scored_by?: number;
  rank?: number;
  popularity?: number;
  synopsis?: string;
  season?: string;
  year?: number;
  studios?: { mal_id: number; name: string }[];
  genres?: { mal_id: number; name: string }[];
  themes?: { mal_id: number; name: string }[];
}

// NOTE: this file only normalizes Jikan API responses — it must never make
// HTTP calls to the Jikan API itself. All requests to Jikan go through
// jikanService.ts (jikanFetch), which owns pacing/retry/caching. Fetching
// here would bypass that throttle and retry logic. See CLAUDE.md /
// scripts/check_provider_calls.mjs.

export function slugifyTitle(title: string, malId: number): string {
  const clean = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return clean || `anime-${malId}`;
}

export function normalizeJikanAnime(item: JikanAnime) {
  const id = slugifyTitle(item.title, item.mal_id);
  const poster =
    item.images.webp?.large_image_url ||
    item.images.jpg.large_image_url ||
    item.images.jpg.image_url;
  const banner = item.images.jpg.large_image_url || poster;

  const genres = (item.genres || []).map((g) => g.name);
  const studios = (item.studios || []).map((s) => s.name);
  const themes = (item.themes || []).map((t) => t.name);

  let airingStatus = 'Finished';
  if (item.airing || item.status === 'Currently Airing') airingStatus = 'Airing';
  if (item.status === 'Not yet aired') airingStatus = 'Upcoming';

  return {
    id,
    externalId: String(item.mal_id),
    externalSource: 'mal',
    title: item.title,
    englishTitle: item.title_english || item.title,
    japaneseTitle: item.title_japanese || '',
    romajiTitle: item.title,
    synopsis: item.synopsis || 'No synopsis available.',
    type: item.type || 'TV',
    episodes: item.episodes || null,
    status: airingStatus,
    season: item.season ? item.season.charAt(0).toUpperCase() + item.season.slice(1) : undefined,
    year: item.year || (item.aired?.from ? new Date(item.aired.from).getFullYear() : undefined),
    score: item.score || null,
    ratingCount: item.scored_by || 0,
    rank: item.rank || undefined,
    popularity: item.popularity || undefined,
    posterImage: poster,
    bannerImage: banner,
    genres,
    themes,
    studios: studios.length > 0 ? studios : ['Unknown Studio'],
    duration: item.duration || '24 min',
    source: item.source || 'Original',
  };
}

// Fetching helpers (fetchTopAnimeFromJikan, fetchSeasonalAnimeFromJikan,
// searchAnimeFromJikan) used to live here, calling the Jikan API directly
// with no pacing/retry/cache. Removed 2026-09-15 — use jikanService.ts's
// getJikanTopAnime / getJikanCurrentSeason / searchJikanAnime instead, and
// pass their raw items through normalizeJikanAnime() above.
