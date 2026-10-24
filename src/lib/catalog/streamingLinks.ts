/**
 * Imports official streaming listings ("where to watch") from AniList into
 * StreamingAvailability — used by the schedule page and the anime page's
 * "Where to Watch" section.
 *
 * Add-only by design (CLAUDE.md: deletion safety, editorial wins):
 *   - Rows are only ever inserted, never updated or deleted. AniList not
 *     listing a platform any more is not proof it stopped streaming there.
 *   - Rows from any other source (an editor, a future official feed) are
 *     never touched; an AniList link for a platform that already has a row
 *     is skipped rather than duplicated.
 *   - An anime AniList didn't return at all is simply left alone.
 *
 * AniList doesn't say which regions a listing covers or whether it's
 * subscription/free, so rows are stored with region "GLOBAL" (meaning: not
 * tied to a region) and availabilityType "UNKNOWN"; the UI says
 * availability varies by region and never shows a price tier for these.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { anilistProvider } from '../providers/anilistProvider';

export const ANILIST_STREAMING_SOURCE = 'anilist';
const BATCH = 50;

export interface StreamingSyncResult {
  checked: number;
  /** Anime AniList returned (with or without streaming links). */
  answered: number;
  linksFound: number;
  rowsWritten: number;
}

export async function syncStreamingLinks(
  animeIds: string[],
  { apply = true }: { apply?: boolean } = {}
): Promise<StreamingSyncResult> {
  const result: StreamingSyncResult = { checked: 0, answered: 0, linksFound: 0, rowsWritten: 0 };
  if (animeIds.length === 0) return result;

  const anime = await prisma.anime.findMany({
    where: { id: { in: animeIds }, OR: [{ anilistId: { not: null } }, { malId: { not: null } }] },
    select: {
      id: true,
      anilistId: true,
      malId: true,
      streamingAvailability: { select: { provider: true } },
    },
  });
  result.checked = anime.length;

  const byAnilist = anime.filter((a) => a.anilistId !== null);
  const byMal = anime.filter((a) => a.anilistId === null && a.malId !== null);

  const lookup = async (rows: typeof anime, by: 'anilist' | 'mal') => {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      let answers;
      try {
        answers = await anilistProvider.getStreamingLinks(
          batch.map((a) => (by === 'anilist' ? a.anilistId! : a.malId!)),
          by
        );
      } catch (err) {
        // Provider failure: nothing is written or removed; the next run retries.
        logger.warn('AniList streaming-link lookup failed', { component: 'catalog/streamingLinks', error: err as Error });
        continue;
      }

      for (const a of batch) {
        const hit = answers.get(by === 'anilist' ? a.anilistId! : a.malId!);
        if (!hit) continue;
        result.answered++;
        const existing = new Set(a.streamingAvailability.map((s) => s.provider.toLowerCase()));
        const fresh = hit.links.filter((l) => {
          const key = l.name.toLowerCase();
          if (existing.has(key)) return false;
          existing.add(key);
          return true;
        });
        result.linksFound += hit.links.length;
        if (!apply || fresh.length === 0) continue;

        await prisma.streamingAvailability.createMany({
          data: fresh.map((l) => ({
            animeId: a.id,
            provider: l.name,
            url: l.url,
            region: 'GLOBAL',
            availabilityType: 'UNKNOWN',
            source: ANILIST_STREAMING_SOURCE,
            lastVerifiedAt: new Date(),
          })),
        });
        result.rowsWritten += fresh.length;
        // Pure provenance: remember the AniList id when we only had MAL's.
        if (by === 'mal' && !a.anilistId) {
          await prisma.anime.update({ where: { id: a.id }, data: { anilistId: hit.anilistId } }).catch(() => {});
        }
      }
    }
  };

  await lookup(byAnilist, 'anilist');
  await lookup(byMal, 'mal');
  return result;
}

/**
 * Streaming links for whatever is on the schedule in the coming week and
 * has none recorded yet. Called after each schedule refresh, so newly
 * airing shows get a "where to watch" without a manual backfill.
 */
export async function syncStreamingLinksForUpcomingSchedule(): Promise<StreamingSyncResult> {
  const now = Date.now();
  const rows = await prisma.airingSchedule.findMany({
    where: {
      airingAt: { gte: new Date(now - 24 * 60 * 60 * 1000), lte: new Date(now + 8 * 24 * 60 * 60 * 1000) },
      anime: { streamingAvailability: { none: {} } },
    },
    select: { animeId: true },
    distinct: ['animeId'],
  });
  return syncStreamingLinks(rows.map((r) => r.animeId));
}
