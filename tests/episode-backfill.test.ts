import './helpers/setupTestDb';

import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { createAnime } from './helpers/fixtures';
import { runEpisodeBackfillBatch } from '../src/lib/catalog/episodeBackfillEngine';
import type { ProviderEpisode } from '../src/lib/providers/animeProvider.interface';

after(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Each test in this file shares the same fixed SyncCheckpoint key
  // (provider='multi', jobType='EPISODE_BACKFILL') — reset it, and the
  // catalog, between tests so they don't see each other's state.
  await prisma.syncCheckpoint.deleteMany({ where: { provider: 'multi', jobType: 'EPISODE_BACKFILL' } });
  await prisma.episode.deleteMany({});
  await prisma.anime.deleteMany({});
});

function ep(number: number): ProviderEpisode {
  return { number, filler: false, recap: false, title: `Ep ${number}` };
}

/** A fake provider-getter: `pagesByExternalId[externalId]` is an array of pages, each an array of ProviderEpisode. Records every (externalId, page) call it receives. */
function fakeProviderGetter(
  pagesByExternalId: Record<string, ProviderEpisode[][]>,
  opts: { throwOnCall?: { externalId: string; page: number } } = {}
) {
  const calls: { externalId: string; page: number }[] = [];
  const getProvider = (_name: 'anilist' | 'jikan') => ({
    async getAnimeEpisodes(externalId: string, page = 1) {
      calls.push({ externalId, page });
      if (opts.throwOnCall && opts.throwOnCall.externalId === externalId && opts.throwOnCall.page === page) {
        throw new Error(`simulated failure on ${externalId} page ${page}`);
      }
      const pages = pagesByExternalId[externalId] || [];
      const episodes = pages[page - 1] || [];
      const hasNextPage = page < pages.length;
      return { episodes, pagination: { currentPage: page, lastVisiblePage: pages.length, hasNextPage }, provider: 'jikan' as const };
    },
  });
  return { getProvider: getProvider as any, calls };
}

describe('episode backfill: priority ordering', () => {
  test('currently-airing anime is processed before finished ones, regardless of creation order', async () => {
    const finished = await createAnime({ malId: 9001, status: 'Finished', popularity: 5, episodes: 1 });
    const airing = await createAnime({ malId: 9002, status: 'Currently Airing', popularity: 999, episodes: null });

    const { getProvider, calls } = fakeProviderGetter({
      '9002': [[ep(1)]],
      '9001': [[ep(1)]],
    });

    await runEpisodeBackfillBatch(10, getProvider);

    assert.deepEqual(
      calls.map((c) => c.externalId),
      ['9002', '9001'],
      'the airing anime (9002) must be fetched before the finished one (9001) despite worse "popularity"'
    );
    void finished;
    void airing;
  });

  test('among anime in the same tier, lower popularity number (more popular) goes first', async () => {
    await createAnime({ malId: 9101, status: 'Finished', popularity: 50, episodes: 1 });
    await createAnime({ malId: 9102, status: 'Finished', popularity: 5, episodes: 1 });

    const { getProvider, calls } = fakeProviderGetter({
      '9101': [[ep(1)]],
      '9102': [[ep(1)]],
    });

    await runEpisodeBackfillBatch(10, getProvider);

    assert.deepEqual(calls.map((c) => c.externalId), ['9102', '9101']);
  });

  test('an anime whose episode count already matches its declared total is skipped entirely', async () => {
    const complete = await createAnime({ malId: 9201, status: 'Finished', popularity: 1, episodes: 1 });
    await prisma.episode.create({ data: { animeId: complete.id, number: 1 } });
    await createAnime({ malId: 9202, status: 'Finished', popularity: 2, episodes: 1 });

    const { getProvider, calls } = fakeProviderGetter({ '9202': [[ep(1)]] });

    await runEpisodeBackfillBatch(10, getProvider);

    assert.deepEqual(calls.map((c) => c.externalId), ['9202'], 'the already-complete anime (9201) must never be fetched');
  });
});

describe('episode backfill: writes episodes per page, not buffered', () => {
  test('episodes from every page are written to the DB', async () => {
    const anime = await createAnime({ malId: 9301, status: 'Currently Airing', episodes: null });
    const { getProvider } = fakeProviderGetter({ '9301': [[ep(1), ep(2)], [ep(3)]] });

    const result = await runEpisodeBackfillBatch(10, getProvider);

    const episodes = await prisma.episode.findMany({ where: { animeId: anime.id }, orderBy: { number: 'asc' } });
    assert.deepEqual(episodes.map((e) => e.number), [1, 2, 3]);
    assert.equal(result.episodesWritten, 3);
    assert.equal(result.pagesProcessed, 2);
    assert.equal(result.animeCompleted, 1);
  });

  test('provenance (DataSourceRecord) is recorded for the anime once its episodes are exhausted', async () => {
    const anime = await createAnime({ malId: 9302, status: 'Currently Airing', episodes: null });
    const { getProvider } = fakeProviderGetter({ '9302': [[ep(1)]] });

    await runEpisodeBackfillBatch(10, getProvider);

    const record = await prisma.dataSourceRecord.findUnique({
      where: { entityType_entityId_provider: { entityType: 'EPISODE', entityId: anime.id, provider: 'jikan' } },
    });
    assert.ok(record);
    assert.equal(record?.externalId, '9302');
  });
});

describe('episode backfill: resumability on failure', () => {
  test('a failure mid-anime leaves the checkpoint on the failed page; the next run resumes there, not from page 1', async () => {
    const anime = await createAnime({ malId: 9401, status: 'Currently Airing', episodes: null });

    const failing = fakeProviderGetter(
      { '9401': [[ep(1)], [ep(2)], [ep(3)]] },
      { throwOnCall: { externalId: '9401', page: 2 } }
    );

    await assert.rejects(runEpisodeBackfillBatch(10, failing.getProvider));

    // Page 1 was written before the failure on page 2.
    let episodes = await prisma.episode.findMany({ where: { animeId: anime.id } });
    assert.deepEqual(episodes.map((e) => e.number), [1]);

    const checkpointAfterFailure = await prisma.syncCheckpoint.findUnique({
      where: { provider_jobType: { provider: 'multi', jobType: 'EPISODE_BACKFILL' } },
    });
    assert.equal(checkpointAfterFailure?.page, 2, 'checkpoint must still point at the page that failed, not have advanced past it');

    // Re-run with a working fake — must resume at page 2, not refetch page 1.
    const succeeding = fakeProviderGetter({ '9401': [[ep(1)], [ep(2)], [ep(3)]] });
    await runEpisodeBackfillBatch(10, succeeding.getProvider);

    assert.deepEqual(
      succeeding.calls.map((c) => c.page),
      [2, 3],
      'the resumed run must start at page 2 — page 1 was already durably written'
    );

    episodes = await prisma.episode.findMany({ where: { animeId: anime.id }, orderBy: { number: 'asc' } });
    assert.deepEqual(episodes.map((e) => e.number), [1, 2, 3]);
  });
});

describe('episode backfill: catalog-wide cursor', () => {
  test('finishes every eligible anime in one batch (within budget) and a later run finds nothing left, without stalling or throwing', async () => {
    await createAnime({ malId: 9501, status: 'Finished', popularity: 1, episodes: 1 });
    await createAnime({ malId: 9502, status: 'Finished', popularity: 2, episodes: 1 });

    const first = fakeProviderGetter({ '9501': [[ep(1)]], '9502': [[ep(1)]] });
    const firstResult = await runEpisodeBackfillBatch(10, first.getProvider);
    // Both anime now have a full episode count matching their declared
    // total, so neither is eligible anymore — the batch's own end-of-run
    // wrap-scan (looking for more work before its page budget runs out)
    // finds nothing, which is what sets wrappedAround here: it's an
    // accurate "a wrap was attempted," not evidence of anything left to do.
    assert.equal(firstResult.animeCompleted, 2);
    assert.equal(first.calls.length, 2, 'exactly one fetch per anime — no unnecessary re-fetching once both are complete');

    // A later run confirms there's genuinely nothing left, without hanging.
    const second = fakeProviderGetter({});
    const secondResult = await runEpisodeBackfillBatch(10, second.getProvider);
    assert.equal(secondResult.noEligibleAnime, true);
  });

  test('a currently-airing anime stays eligible indefinitely (never "complete") and is revisited on wraparound', async () => {
    const anime = await createAnime({ malId: 9601, status: 'Currently Airing', episodes: null });

    const round1 = fakeProviderGetter({ '9601': [[ep(1)]] });
    await runEpisodeBackfillBatch(10, round1.getProvider);

    const round2 = fakeProviderGetter({ '9601': [[ep(1)]] });
    const result2 = await runEpisodeBackfillBatch(10, round2.getProvider);

    assert.equal(result2.wrappedAround, true);
    assert.deepEqual(round2.calls.map((c) => c.externalId), ['9601']);
    void anime;
  });
});
