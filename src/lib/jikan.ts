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

const JIKAN_BASE_URL = process.env.JIKAN_BASE_URL || 'https://api.jikan.moe/v4';

// Helper to delay requests to respect Jikan rate limits (3 req/sec)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

export async function fetchTopAnimeFromJikan(page = 1, limit = 25): Promise<ReturnType<typeof normalizeJikanAnime>[]> {
  try {
    const url = `${JIKAN_BASE_URL}/top/anime?page=${page}&limit=${limit}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.warn(`Jikan top anime returned ${res.status}`);
      return [];
    }
    const json = await res.json();
    if (!json.data || !Array.isArray(json.data)) return [];
    return json.data.map(normalizeJikanAnime);
  } catch (err) {
    console.error('Failed to fetch from Jikan:', err);
    return [];
  }
}

export async function fetchSeasonalAnimeFromJikan(page = 1, limit = 25): Promise<ReturnType<typeof normalizeJikanAnime>[]> {
  try {
    const url = `${JIKAN_BASE_URL}/seasons/now?page=${page}&limit=${limit}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.warn(`Jikan seasons/now returned ${res.status}`);
      return [];
    }
    const json = await res.json();
    if (!json.data || !Array.isArray(json.data)) return [];
    return json.data.map(normalizeJikanAnime);
  } catch (err) {
    console.error('Failed to fetch seasonal from Jikan:', err);
    return [];
  }
}

export async function searchAnimeFromJikan(query: string): Promise<ReturnType<typeof normalizeJikanAnime>[]> {
  if (!query.trim()) return [];
  try {
    const url = `${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(query)}&limit=15&sfw=true`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.data || !Array.isArray(json.data)) return [];
    return json.data.map(normalizeJikanAnime);
  } catch (err) {
    console.error('Jikan search error:', err);
    return [];
  }
}
