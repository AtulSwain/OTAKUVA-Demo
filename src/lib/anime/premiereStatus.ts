/**
 * Whether an anime has actually started airing. Ratings, reviews, the vibe
 * aggregate, the episode guide and community review sections only make
 * sense once real episodes exist to have an opinion about — before that,
 * the detail page shows the announced facts only (synopsis, studio,
 * source, staff, cast) and no rating/review entry points.
 *
 * `status` is a raw provider string and its casing varies by source
 * ("Not yet aired" from Jikan, "NOT_YET_AIRED" from AniList, etc.), so this
 * matches case-insensitively against the known "hasn't aired" values
 * rather than an exact string. An unrecognized or missing status defaults
 * to "has premiered" — failing open, since incorrectly hiding rating on a
 * normal aired title (formats or historical statuses recorded differently)
 * would remove a working, everyday feature, while incorrectly showing the
 * rating prompt on an unusual status string is a smaller, recoverable UX
 * bug — and the true "not yet aired" strings below are already covering
 * every variant this catalog imports.
 */
const NOT_YET_AIRED_STATUSES = new Set([
  'not yet aired',
  'not_yet_aired',
  'upcoming',
]);

export function hasAnimePremiered(status?: string | null): boolean {
  if (!status) return true;
  return !NOT_YET_AIRED_STATUSES.has(String(status).toLowerCase().trim());
}
