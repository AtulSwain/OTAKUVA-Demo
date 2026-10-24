/**
 * Browse page constants and parameter handling. Safe to import from both
 * server and client code (no database access here).
 *
 * Every value that reaches a query comes from these allowlists — anything
 * else in the URL is ignored, never passed on.
 */

// Shown on the Top Picks page (/top-picks; /browse redirects there), in this
// order. Icons are mapped in the page (this module stays React-free).
export const BROWSE_TABS = [
  { id: 'top100', label: 'Top 100', limit: 100, blurb: 'The 100 highest-rated anime among titles with a large following (over 50,000 members).' },
  { id: 'binge', label: 'Binge-Worthy', limit: 50, blurb: 'Good for a weekend: completed TV series of 12 to 52 episodes that people rate highly (7.5 or more) and have watched in large numbers.' },
  { id: 'viewed', label: 'Most Popular', limit: 10, blurb: 'Ranked by how many people follow a title (its member count).' },
  { id: 'gems', label: 'Hidden Gems', limit: 30, blurb: 'Rated 7.8 or higher but followed by fewer than 200,000 people, so easy to miss.' },
  { id: 'movies', label: 'Best Movies', limit: 30, blurb: 'The highest-rated anime films with a solid following.' },
  { id: 'awards', label: 'Award Winners', limit: 10, blurb: 'Anime of the Year winners from the Crunchyroll Anime Awards.' },
  { id: 'choice', label: 'OTAKUVA Choice', limit: 10, blurb: 'Hand-picked by the OTAKUVA team.' },
  { id: 'rated', label: 'Most Rated', limit: 10, blurb: 'Highest community score among widely followed titles.' },
  { id: 'monthly', label: 'Top 10 Monthly', limit: 10, blurb: 'Titles airing right now, ranked by how many people follow them. This is not a strict calendar month.' },
] as const;
export type BrowseTabId = (typeof BROWSE_TABS)[number]['id'];

/** `db` lists the stored `Anime.type` values each format covers. */
export const BROWSE_FORMATS = [
  { id: 'TV', label: 'TV Series', db: ['TV'] },
  { id: 'MOVIE', label: 'Movie', db: ['Movie'] },
  { id: 'OVA', label: 'OVA', db: ['OVA'] },
  { id: 'ONA', label: 'ONA (web)', db: ['ONA'] },
  { id: 'SPECIAL', label: 'Special', db: ['Special', 'TV Special'] },
] as const;
export type BrowseFormatId = (typeof BROWSE_FORMATS)[number]['id'];

export const BROWSE_COUNTRIES = [
  { id: 'JP', label: 'Japan' },
  { id: 'CN', label: 'China' },
  { id: 'KR', label: 'South Korea' },
  { id: 'TW', label: 'Taiwan' },
] as const;

export const BROWSE_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mecha', 'Music', 'Mystery',
  'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
] as const;

/** Family-friendly is a genre/theme filter, not an official age rating. */
export const FAMILY_EXCLUDED_GENRES = ['Ecchi', 'Horror', 'Hentai'];
export const FAMILY_EXCLUDED_THEMES = ['Gore', 'Nudity'];

export interface BrowseFilters {
  genre?: string;
  format?: BrowseFormatId;
  country?: string;
  family?: boolean;
}
export interface BrowseState extends BrowseFilters {
  tab: BrowseTabId;
}

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Where the curated lists live (Browse became Top Picks on 2026-10-18). */
export const TOP_PICKS_PATH = '/top-picks';
/** The Top Picks page opens on Top 100; /api/browse keeps its old default. */
export const TOP_PICKS_DEFAULT_TAB: BrowseTabId = 'top100';

export function parseBrowseParams(raw: Raw, defaultTab: BrowseTabId = 'viewed'): BrowseState {
  const tab = BROWSE_TABS.find((t) => t.id === first(raw.tab))?.id ?? defaultTab;
  const genre = BROWSE_GENRES.find((g) => g === first(raw.genre));
  const format = BROWSE_FORMATS.find((f) => f.id === first(raw.format))?.id;
  const country = BROWSE_COUNTRIES.find((c) => c.id === first(raw.country))?.id;
  const family = first(raw.family) === '1';
  return { tab, genre, format, country, family };
}

export function browseHref(state: BrowseState, overrides: Partial<BrowseState> = {}): string {
  const s = { ...state, ...overrides };
  const q = new URLSearchParams();
  if (s.tab !== TOP_PICKS_DEFAULT_TAB) q.set('tab', s.tab);
  if (s.genre) q.set('genre', s.genre);
  if (s.format) q.set('format', s.format);
  if (s.country) q.set('country', s.country);
  if (s.family) q.set('family', '1');
  const str = q.toString();
  return str ? `${TOP_PICKS_PATH}?${str}` : TOP_PICKS_PATH;
}

export interface BrowseItem {
  id: string;
  slug: string;
  title: string;
  posterUrl: string;
  /** Wide AniList banner, when the anime has one. */
  bannerUrl?: string | null;
  year: number | null;
  format: string;
  genres: string[];
  /** Community score on a 0–10 scale. */
  score: number | null;
  /** OTAKUVA members' average rating (null until someone rates it). */
  otakuvaScore?: number | null;
  status: string;
  synopsis: string;
  /** Row label: the rank number, or the ceremony year for awards. */
  label: string;
  caption?: string;
  note?: string;
}

export function tabLimit(id: BrowseTabId): number {
  return BROWSE_TABS.find((x) => x.id === id)?.limit ?? 10;
}
