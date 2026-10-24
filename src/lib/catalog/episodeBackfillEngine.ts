/**
 * OTAKUVA — resumable, catalog-wide episode backfill.
 *
 * One `SyncCheckpoint` row (provider='multi', jobType='EPISODE_BACKFILL' —
 * "multi" because which provider actually serves any given anime varies
 * per-anime via failover, see src/lib/providers/failoverProvider.ts) walks
 * a cursor through every anime with a known provider id, in priority
 * order (currently-airing first, then by popularity), paging through each
 * one's episode list and writing every page's episodes to the DB as soon
 * as that page is fetched — never buffering a whole anime's episode list
 * in memory first, unlike src/lib/syncEngine.ts's syncEpisodes() (which
 * this module intentionally does NOT reuse for that reason, though it
 * shares that function's episode-upsert logic via
 * src/lib/catalog/episodeIngest.ts).
 *
 * Resumability: the checkpoint's `page` field is only ever advanced
 * *after* a page's episodes have been durably written — if a page fetch
 * or write throws, the checkpoint is exactly where it was before that
 * page started, so the next run (whether that's a queue retry moments
 * later or the next scheduled tick) resumes that exact page rather than
 * re-paging the whole anime or restarting the whole cursor. The BullMQ
 * job wrapper (src/lib/queue/handlers.ts's handleEpisodeBackfill) doesn't
 * need any of its own resume logic for this reason — it just calls
 * runEpisodeBackfillBatch() again.
 *
 * Rate limiting: pages are fetched strictly one at a time (no
 * Promise.all fan-out across anime or pages) through the same
 * failover-wrapped providers everything else uses — jikanService.ts's own
 * throttle()/backoff and anilistProvider.ts's RateLimiter already pace
 * every individual HTTP request; this module's only added responsibility
 * is capping how many pages one invocation processes
 * (`maxPagesPerRun`), so one queue job never runs unboundedly long.
 *
 * Priority ordering (currently-airing, then by popularity — lower
 * `popularity` value = more popular, matching Jikan/AniList's own
 * convention of ranking popularity #1 = most popular) is expressed as one
 * SQL `ORDER BY` and captured, not recomputed, as the resume cursor: once
 * an anime is completed, its (isAiringTier, popularity, id) triple is
 * stored so the next "find the next anime" query can resume past exactly
 * that point via a row-value comparison — correct even if other anime's
 * popularity shifts between runs, since only the completed anime's
 * captured values matter for "what comes after it" in a stable ordering
 * tie-broken by id. Reaching the end wraps back to the top (an
 * ever-running backfill, not a one-shot: currently-airing shows get new
 * episodes indefinitely).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { getFailoverProvider } from '../providers';
import { upsertEpisodeFromProvider, notifyLibraryUsersOfNewEpisodes } from './episodeIngest';
import { recordDataSourceProvenance } from './provenance';
import { JOB_TYPES } from '../queue/jobTypes';

const PROVIDER = 'multi';
const JOB_TYPE = JOB_TYPES.EPISODE_BACKFILL;
const NOT_ELIGIBLE_POPULARITY = 2147483647; // sorts last among anime with no popularity rank

interface BackfillCursorMeta {
  // The (tier, popularity, id) triple of the last anime *completed* —
  // "find the next anime after this point in the priority ordering".
  cursorTier?: 0 | 1;
  cursorPopularity?: number;
  // Set while actively paging through one anime; cleared once that
  // anime's episode list is exhausted.
  currentAnimeId?: string | null;
}

function parseMeta(raw: string | null): BackfillCursorMeta {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as BackfillCursorMeta;
  } catch {
    return {};
  }
}

interface EligibleAnime {
  id: string;
  malId: number | null;
  anilistId: number | null;
  status: string;
  popularity: number | null;
}

/**
 * "Known provider id" + "not already fully backfilled": a currently-
 * airing show is always worth another pass (it gets new episodes over
 * time, and its final episode count isn't known yet); a finished one only
 * if our recorded episode count is short of its declared total.
 */
async function findNextEligibleAnime(after: { tier: 0 | 1; popularity: number; id: string } | null): Promise<EligibleAnime | null> {
  const rows = await prisma.$queryRaw<EligibleAnime[]>`
    SELECT "id", "malId", "anilistId", "status", "popularity"
    FROM "Anime"
    WHERE "status" != 'MERGED'
      AND ("malId" IS NOT NULL OR "anilistId" IS NOT NULL)
      AND (
        "status" = 'Currently Airing'
        OR "episodes" IS NULL
        OR (SELECT COUNT(*)::int FROM "Episode" WHERE "Episode"."animeId" = "Anime"."id") < "episodes"
      )
      ${
        after
          ? Prisma.sql`AND (
              CASE WHEN "status" = 'Currently Airing' THEN 0 ELSE 1 END,
              COALESCE("popularity", ${NOT_ELIGIBLE_POPULARITY}),
              "id"
            ) > (${after.tier}, ${after.popularity}, ${after.id})`
          : Prisma.empty
      }
    ORDER BY
      CASE WHEN "status" = 'Currently Airing' THEN 0 ELSE 1 END ASC,
      COALESCE("popularity", ${NOT_ELIGIBLE_POPULARITY}) ASC,
      "id" ASC
    LIMIT 1
  `;
  return rows[0] || null;
}

async function getOrCreateCheckpoint() {
  const existing = await prisma.syncCheckpoint.findUnique({
    where: { provider_jobType: { provider: PROVIDER, jobType: JOB_TYPE } },
  });
  if (existing) return existing;
  return prisma.syncCheckpoint.create({
    data: { provider: PROVIDER, jobType: JOB_TYPE, page: 1 },
  });
}

export interface BackfillBatchResult {
  pagesProcessed: number;
  episodesWritten: number;
  animeCompleted: number;
  animeTouched: string[];
  wrappedAround: boolean;
  noEligibleAnime: boolean;
}

/**
 * Processes up to `maxPagesPerRun` episode-list pages, resuming from
 * wherever the checkpoint left off. Safe to call repeatedly/concurrently
 * is NOT guaranteed (see src/lib/queue/recurring.ts — this only ever runs
 * as one BullMQ job at a time via the queue's own concurrency=1 default),
 * but is safe to call again immediately after a thrown error — it will
 * pick back up from the last durably-written page.
 *
 * `getProvider` defaults to the real getFailoverProvider (src/lib/
 * providers/index.ts) — overridable so tests/episode-backfill.test.ts can
 * inject a fake provider without real network calls, same shape as
 * tests/provider-failover.test.ts's fakes.
 */
export async function runEpisodeBackfillBatch(
  maxPagesPerRun = 10,
  getProvider: (name: 'anilist' | 'jikan') => ReturnType<typeof getFailoverProvider> = getFailoverProvider
): Promise<BackfillBatchResult> {
  let checkpoint = await getOrCreateCheckpoint();
  let meta = parseMeta(checkpoint.metadata);

  let pagesProcessed = 0;
  let episodesWritten = 0;
  let animeCompleted = 0;
  let wrappedAround = false;
  const animeTouched = new Set<string>();
  // Newly-aired episode count per anime, accumulated across every page
  // this run touches (an anime can span multiple pages/loop iterations)
  // and notified once at the very end — see the notifyLibraryUsersOfNewEpisodes
  // call after the loop for why this is batched rather than per-page.
  const newlyAiredByAnime = new Map<string, number>();
  // Anime already *completed* within this same batch call. Guards against
  // an eligible set smaller than maxPagesPerRun: without this, once the
  // cursor reaches the end, wrapping to the top can land right back on an
  // anime this same call just finished (in the limit, one
  // currently-airing anime that never "completes" and so never advances
  // the cursor past itself) — re-processing it over and over until the
  // page budget runs out instead of stopping and leaving the rest of the
  // budget for the next scheduled tick.
  const completedThisRun = new Set<string>();

  while (pagesProcessed < maxPagesPerRun) {
    // ---- Step 1: pick the anime to work on, if we're not mid-anime ----
    if (!meta.currentAnimeId) {
      const cursor =
        meta.cursorTier !== undefined && meta.cursorPopularity !== undefined && checkpoint.lastProcessedId
          ? { tier: meta.cursorTier, popularity: meta.cursorPopularity, id: checkpoint.lastProcessedId }
          : null;

      let target = await findNextEligibleAnime(cursor);
      if (!target && cursor) {
        // Reached the end of the priority ordering — start a fresh pass
        // from the top rather than stopping forever.
        target = await findNextEligibleAnime(null);
        wrappedAround = true;
      }

      if (target && completedThisRun.has(target.id)) {
        logger.info('episode backfill: wraparound landed back on an anime already completed this run — stopping here for this tick', { animeId: target.id });
        break;
      }

      if (!target) {
        logger.info('episode backfill: no eligible anime found this run', {});
        break;
      }

      meta = { ...meta, currentAnimeId: target.id };
      checkpoint = await prisma.syncCheckpoint.update({
        where: { id: checkpoint.id },
        data: { page: 1, metadata: JSON.stringify(meta) },
      });
      if (wrappedAround) {
        logger.info('episode backfill: completed a full pass over the catalog, starting over', { restartingAt: target.id });
      }
    }

    // ---- Step 2: fetch + write exactly one page for the current anime ----
    const animeId = meta.currentAnimeId as string;
    const anime = await prisma.anime.findUnique({
      where: { id: animeId },
      select: { id: true, malId: true, anilistId: true, status: true, popularity: true },
    });

    if (!anime) {
      // Deleted/merged since it was picked — drop it and pick a new target next loop iteration.
      meta = { ...meta, currentAnimeId: null };
      checkpoint = await prisma.syncCheckpoint.update({ where: { id: checkpoint.id }, data: { metadata: JSON.stringify(meta) } });
      continue;
    }

    const primaryProvider: 'anilist' | 'jikan' = anime.malId ? 'jikan' : 'anilist';
    const externalId = anime.malId ? String(anime.malId) : String(anime.anilistId);
    const provider = getProvider(primaryProvider);
    const page = checkpoint.page;

    // Intentionally not try/caught: on a genuine failure, this throws out
    // of runEpisodeBackfillBatch entirely, and the checkpoint stays
    // exactly as it was before this page (nothing above advances `page`
    // until after a successful write) — that's the resumability contract.
    const res = await provider.getAnimeEpisodes(externalId, page);

    let pageWriteCount = 0;
    let pageNewlyAiredCount = 0;
    for (const ep of res.episodes) {
      const result = await upsertEpisodeFromProvider(animeId, ep);
      if (result.success) pageWriteCount++;
      if (result.isNewlyAired) pageNewlyAiredCount++;
    }
    if (pageNewlyAiredCount > 0) {
      newlyAiredByAnime.set(animeId, (newlyAiredByAnime.get(animeId) || 0) + pageNewlyAiredCount);
    }
    episodesWritten += pageWriteCount;
    animeTouched.add(animeId);
    pagesProcessed++;

    const animeExhausted = res.episodes.length === 0 || !res.pagination.hasNextPage;

    if (animeExhausted) {
      if (res.episodes.length > 0 || page > 1) {
        await recordDataSourceProvenance('EPISODE', animeId, res.provider, externalId);
      }
      animeCompleted++;
      completedThisRun.add(animeId);
      const tier: 0 | 1 = anime.status === 'Currently Airing' ? 0 : 1;
      meta = { cursorTier: tier, cursorPopularity: anime.popularity ?? NOT_ELIGIBLE_POPULARITY, currentAnimeId: null };
      checkpoint = await prisma.syncCheckpoint.update({
        where: { id: checkpoint.id },
        data: {
          page: 1,
          lastProcessedId: animeId,
          metadata: JSON.stringify(meta),
          processedCount: { increment: pageWriteCount },
          updatedCount: { increment: pageWriteCount },
        },
      });
    } else {
      checkpoint = await prisma.syncCheckpoint.update({
        where: { id: checkpoint.id },
        data: {
          page: page + 1,
          processedCount: { increment: pageWriteCount },
          updatedCount: { increment: pageWriteCount },
        },
      });
    }
  }

  // One notification per anime per batch run, not per page — an anime
  // whose backfill spans several pages in this same tick still only
  // produces one "new episode(s)" notification per tracking user.
  for (const [animeId, newlyAiredCount] of newlyAiredByAnime) {
    await notifyLibraryUsersOfNewEpisodes(animeId, newlyAiredCount);
  }

  return {
    pagesProcessed,
    episodesWritten,
    animeCompleted,
    animeTouched: [...animeTouched],
    wrappedAround,
    noEligibleAnime: pagesProcessed === 0 && animeCompleted === 0,
  };
}
