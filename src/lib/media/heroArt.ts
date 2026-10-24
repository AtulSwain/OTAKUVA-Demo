/**
 * Hero artwork selection. Only AniList banners (1900x400, served from a
 * `/banner/` path) are wide enough to fill a full-bleed hero. Everything else
 * we hold is a portrait poster (MAL ~225-425px wide, AniList ~460px), and
 * stretching one across a 1440px hero is what made backgrounds look blurry —
 * including 14 rows where Jikan ingest stored the poster in `bannerUrl`.
 */
export function isWideBanner(url?: string | null): url is string {
  return typeof url === 'string' && /\/banner\//.test(url);
}

/** The first real banner among the candidates, or null. */
export function pickBanner(...candidates: Array<string | null | undefined>): string | null {
  return candidates.find(isWideBanner) ?? null;
}
