/**
 * "Publish" step for the control center (2026-10-28): the control center and
 * the website share one database, so a save is live data at once — but a few
 * site sections keep a short-lived copy for speed (homepage 1 min, studios
 * 10 min, news / Explore up to an hour). After every successful change this
 * clears those copies so the change shows on otakuva straight away.
 * Every step is best-effort: a cache that can't be cleared (e.g. outside a
 * Next.js request, in tests) just expires on its own timer.
 */
import { revalidatePath, revalidateTag } from 'next/cache';
import { CacheManager } from '@/lib/performance/cacheManager';
import { HOME_SECTIONS_CACHE_TAG } from '@/lib/home/homeCacheTags';
import { HYPE_BOARD_TAG } from '@/lib/hype/hypeService';
import { resetStudioDirectoryMemo } from '@/lib/studios/studioDirectory';
import { resetGenreArtworkCache } from '@/lib/browseService';
import { logger } from '@/lib/logger';

const attempt = (fn: () => unknown) => {
  try {
    fn();
  } catch {
    /* not inside a Next.js request (scripts/tests): the cache just expires */
  }
};

/** Clears the site's cached copies. `animeKeys` = ids/slugs of anime that changed. */
export function refreshSite(animeKeys: string[] = []) {
  // Next.js data cache (homepage, studios list, hype board, platform numbers).
  for (const tag of [HOME_SECTIONS_CACHE_TAG, 'studio-directory', HYPE_BOARD_TAG, 'platform-stats']) attempt(() => revalidateTag(tag));
  // Pages that render on the server.
  for (const path of ['/', '/anime', '/news', '/charts', '/top-picks', '/collections', '/studios', '/schedule']) attempt(() => revalidatePath(path));
  attempt(() => revalidatePath('/charts/[slug]', 'page'));
  // In-memory caches.
  attempt(() => CacheManager.invalidateTag('tag:anime:catalog'));
  attempt(() => CacheManager.invalidateTag('tag:news:list'));
  for (const key of animeKeys) attempt(() => CacheManager.invalidateTag(`tag:anime:${key}`));
  attempt(resetStudioDirectoryMemo);
  attempt(resetGenreArtworkCache);
  logger.info('Control center change published to the site', { component: 'control/publish', animeKeys: animeKeys.length });
}
