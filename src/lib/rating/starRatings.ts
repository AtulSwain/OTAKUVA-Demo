/**
 * The 1–10 star rating is switched off (owner, 2026-10-25): members rate each
 * episode's retention (1–100) and grade the Vibe instead. Nothing new is
 * saved as a 1–10 score — the Rate window, library "personal rating",
 * creator-review scores and the old per-episode scores are all refused or
 * ignored. Ratings already stored are kept untouched (user data), just not
 * shown.
 *
 * Set STAR_RATINGS_ENABLED="true" to turn it back on (the tests that cover
 * the old star logic do this for themselves).
 */
export function starRatingsEnabled(): boolean {
  return process.env.STAR_RATINGS_ENABLED === 'true';
}

export const STAR_RATINGS_OFF_MESSAGE = 'Star ratings are off — rate each episode’s retention instead.';
