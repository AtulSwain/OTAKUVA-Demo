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

/** The YouTube video id in a trailer link (watch?v=, youtu.be/, /embed/, /shorts/), or null. */
export function youtubeVideoId(url?: string | null): string | null {
  if (typeof url !== 'string') return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/**
 * Wide stills from the anime's own official trailer (owner, 2026-10-25: a
 * related image behind the hero, not the poster). Real artwork from the
 * show, 16:9. Best first: maxres (1280x720) isn't made for every video —
 * when it's missing YouTube serves a 120x90 stand-in, so the caller steps
 * down the list until a real-size still loads. hqdefault always exists.
 */
export function trailerStills(url?: string | null): string[] {
  const id = youtubeVideoId(url);
  if (!id) return [];
  return ['maxresdefault', 'sddefault', 'hqdefault'].map((q) => `https://i.ytimg.com/vi/${id}/${q}.jpg`);
}
