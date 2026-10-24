/**
 * OTAKUVA — CONTENT/AGE RATING FORMATTING
 *
 * `Anime.rating` stores the raw MAL/Jikan classification string verbatim
 * (e.g. "PG-13 - Teens 13 or older", "R+ - Mild Nudity") — see
 * `src/lib/providers/jikanProvider.ts` and `syncEngine.ingestAnime`, which
 * already persist whatever the provider returned, unmodified. This module
 * only *formats* that already-verified value for display; it never invents
 * a rating for an anime that doesn't have one (a missing rating stays
 * missing — no badge is rendered — per the platform's no-fabricated-data
 * rule).
 *
 * Jikan's `rating` field is a closed, known enum (the MPAA-style scheme
 * MAL itself uses), so this mapping is exhaustive by construction rather
 * than a guess — any value outside the known set (a future provider
 * addition, or a differently-formatted source) falls back to showing the
 * raw string as-is instead of hiding it.
 */

export interface ContentRatingDisplay {
  /** Short badge text, e.g. "PG-13", "R+". */
  code: string;
  /** One-line description of what the code means, e.g. "Teens 13 or older". */
  description: string;
  /** Whether this classification is for mature/adult audiences (R and up) — used only to apply a restrained visual emphasis, never to hide or gate content. */
  isMature: boolean;
}

// Keyed by the exact code MAL/Jikan puts before " - " in the raw string.
const KNOWN_RATINGS: Record<string, { description: string; isMature: boolean }> = {
  'G': { description: 'All Ages', isMature: false },
  'PG': { description: 'Children', isMature: false },
  'PG-13': { description: 'Teens 13 or older', isMature: false },
  'R': { description: '17+ (violence & profanity)', isMature: true },
  'R+': { description: 'Mild Nudity', isMature: true },
  'Rx': { description: 'Adults Only (Hentai)', isMature: true },
};

export function formatContentRating(raw: string | null | undefined): ContentRatingDisplay | null {
  const value = raw?.trim();
  if (!value) return null;

  const [codePart, ...descParts] = value.split(' - ');
  const code = codePart.trim();
  const known = KNOWN_RATINGS[code];

  if (known) {
    return { code, description: known.description, isMature: known.isMature };
  }

  // Unrecognized format — still show it rather than dropping real data.
  return { code, description: descParts.join(' - ').trim() || value, isMature: false };
}
