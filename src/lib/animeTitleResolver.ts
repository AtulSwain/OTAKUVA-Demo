/**
 * OTAKUVA — CANONICAL ANIME TITLE RESOLVER & NORMALIZER
 * 
 * Centralized, universal, production-safe title resolution engine:
 * - Deterministic fallback order: Configured Preference -> Canonical Title -> English -> Romaji -> Japanese -> Alternative -> Slug -> Safe Default
 * - Robust handling of strings, nested objects, null, undefined, whitespace, and multi-language arrays
 * - Preserves Unicode characters (Kanji, Kana, Cyrillic, Accents, etc.)
 * - Zero crash guarantee (Never throws, never returns 'undefined', 'null', or '[object Object]')
 */

export type TitleDisplayPreference = 'canonical' | 'english' | 'romaji' | 'japanese';

export interface TitleSourceEntity {
  id?: string | null;
  slug?: string | null;
  title?: string | { english?: string | null; romaji?: string | null; native?: string | null; japanese?: string | null } | null;
  canonicalTitle?: string | null;
  englishTitle?: string | null;
  japaneseTitle?: string | null;
  romajiTitle?: string | null;
  titles?: Array<{ type?: string | null; title?: string | null; language?: string | null }> | null;
  name?: string | null;
}

/**
 * Sanitizes a title candidate, rejecting null, undefined, empty strings, and "[object Object]"
 */
function sanitizeTitle(candidate: any): string | null {
  if (candidate === null || candidate === undefined) return null;
  if (typeof candidate === 'object') {
    // If it's a nested object like { english: '...' }
    if (typeof candidate.english === 'string' && candidate.english.trim()) return candidate.english.trim();
    if (typeof candidate.romaji === 'string' && candidate.romaji.trim()) return candidate.romaji.trim();
    if (typeof candidate.native === 'string' && candidate.native.trim()) return candidate.native.trim();
    if (typeof candidate.japanese === 'string' && candidate.japanese.trim()) return candidate.japanese.trim();
    return null;
  }
  const str = String(candidate).trim();
  if (!str || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null' || str === '[object Object]') {
    return null;
  }
  return str;
}

/**
 * Primary Canonical Title Resolver
 * Returns the best display title for any anime object across OTAKUVA
 */
export function getAnimeDisplayTitle(
  anime?: TitleSourceEntity | null,
  preference: TitleDisplayPreference = 'canonical'
): string {
  if (!anime || typeof anime !== 'object') {
    return 'Untitled Anime';
  }

  // 1. Extract potential title candidates from all known structural variations
  const canonical = sanitizeTitle(anime.canonicalTitle) || sanitizeTitle(anime.title) || sanitizeTitle(anime.name);
  const english =
    sanitizeTitle(anime.englishTitle) ||
    sanitizeTitle((anime.title as any)?.english) ||
    sanitizeTitle(anime.titles?.find((t) => t?.type?.toLowerCase() === 'english')?.title);
  const romaji =
    sanitizeTitle(anime.romajiTitle) ||
    sanitizeTitle((anime.title as any)?.romaji) ||
    sanitizeTitle(anime.titles?.find((t) => t?.type?.toLowerCase() === 'romaji')?.title);
  const japanese =
    sanitizeTitle(anime.japaneseTitle) ||
    sanitizeTitle((anime.title as any)?.native) ||
    sanitizeTitle((anime.title as any)?.japanese) ||
    sanitizeTitle(anime.titles?.find((t) => t?.type?.toLowerCase() === 'japanese')?.title);
  const officialDictTitle = sanitizeTitle(anime.titles?.find((t) => t?.type?.toLowerCase() === 'official')?.title);
  const anyDictTitle = sanitizeTitle(anime.titles?.find((t) => Boolean(sanitizeTitle(t?.title)))?.title);

  // 2. Resolve according to requested preference
  if (preference === 'english' && english) return english;
  if (preference === 'romaji' && romaji) return romaji;
  if (preference === 'japanese' && japanese) return japanese;
  if (preference === 'canonical' && canonical) return canonical;

  // 3. Fallback hierarchy: Canonical -> English -> Romaji -> Japanese -> Official Dictionary -> Any Dictionary
  if (canonical) return canonical;
  if (english) return english;
  if (romaji) return romaji;
  if (japanese) return japanese;
  if (officialDictTitle) return officialDictTitle;
  if (anyDictTitle) return anyDictTitle;

  // 4. Derive fallback from slug or ID if available
  if (anime.slug) {
    const fromSlug = sanitizeTitle(anime.slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    if (fromSlug) return fromSlug;
  }

  if (anime.id && typeof anime.id === 'string' && !anime.id.startsWith('cm') && anime.id.length < 50) {
    const fromId = sanitizeTitle(anime.id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    if (fromId) return fromId;
  }

  return 'Untitled Anime';
}

/**
 * Returns Japanese / Native Title if available
 */
export function getAnimeJapaneseTitle(anime?: TitleSourceEntity | null): string | null {
  if (!anime || typeof anime !== 'object') return null;
  return (
    sanitizeTitle(anime.japaneseTitle) ||
    sanitizeTitle((anime.title as any)?.native) ||
    sanitizeTitle((anime.title as any)?.japanese) ||
    sanitizeTitle(anime.titles?.find((t) => t?.type?.toLowerCase() === 'japanese')?.title) ||
    null
  );
}

/**
 * Returns English Title if available
 */
export function getAnimeEnglishTitle(anime?: TitleSourceEntity | null): string | null {
  if (!anime || typeof anime !== 'object') return null;
  return (
    sanitizeTitle(anime.englishTitle) ||
    sanitizeTitle((anime.title as any)?.english) ||
    sanitizeTitle(anime.titles?.find((t) => t?.type?.toLowerCase() === 'english')?.title) ||
    null
  );
}

/**
 * Returns Romaji Title if available
 */
export function getAnimeRomajiTitle(anime?: TitleSourceEntity | null): string | null {
  if (!anime || typeof anime !== 'object') return null;
  return (
    sanitizeTitle(anime.romajiTitle) ||
    sanitizeTitle((anime.title as any)?.romaji) ||
    sanitizeTitle(anime.titles?.find((t) => t?.type?.toLowerCase() === 'romaji')?.title) ||
    null
  );
}

/**
 * Standardizes any anime object to guarantee both `title` and `canonicalTitle` are populated
 */
export function normalizeAnimeTitleFields<T extends TitleSourceEntity>(anime: T): T & { title: string; canonicalTitle: string } {
  const displayTitle = getAnimeDisplayTitle(anime);
  const english = getAnimeEnglishTitle(anime);
  const japanese = getAnimeJapaneseTitle(anime);
  const romaji = getAnimeRomajiTitle(anime);

  return {
    ...anime,
    title: displayTitle,
    canonicalTitle: displayTitle,
    englishTitle: english || undefined,
    japaneseTitle: japanese || undefined,
    romajiTitle: romaji || undefined,
  };
}
