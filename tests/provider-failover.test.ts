/**
 * src/lib/providers/failoverProvider.ts — pure unit tests against fake
 * adapters (no network, no DB), so no helpers/setupTestDb import needed.
 */
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Short timeout for the "times out" test below — read lazily by
// failoverProvider.ts (see getProviderTimeoutMs()), so setting this before
// that module does any timing work is enough; import order doesn't matter.
process.env.PROVIDER_FAILOVER_TIMEOUT_MS = '300';

import { createFailoverProvider, getProviderTimeoutMs } from '../src/lib/providers/failoverProvider';
import { getProviderHealthSnapshot, _resetProviderHealthForTests } from '../src/lib/providers/providerHealth';
import type { AnimeDataProvider, ProviderAnime, ProviderCharacter, ProviderEpisode } from '../src/lib/providers/animeProvider.interface';

function fakeAnime(overrides: Partial<ProviderAnime> = {}): ProviderAnime {
  return {
    externalId: '1',
    externalSource: 'anilist',
    title: 'Test Anime',
    titles: [],
    synopsis: 'A synopsis',
    type: 'TV',
    status: 'Finished',
    posterUrl: '',
    genres: [],
    themes: [],
    studios: [],
    producers: [],
    licensors: [],
    ...overrides,
  };
}

const emptyPagination = { currentPage: 1, lastVisiblePage: 1, hasNextPage: false };

function makeAdapter(name: 'anilist' | 'jikan', impl: Partial<AnimeDataProvider>): AnimeDataProvider {
  const notImplemented = (method: string) => async () => {
    throw new Error(`${name}.${method} not implemented in this fake`);
  };
  return {
    name,
    searchAnime: notImplemented('searchAnime') as any,
    getAnime: notImplemented('getAnime') as any,
    getAnimeList: notImplemented('getAnimeList') as any,
    getAnimeEpisodes: notImplemented('getAnimeEpisodes') as any,
    getAnimeCharacters: notImplemented('getAnimeCharacters') as any,
    getAnimeStaff: notImplemented('getAnimeStaff') as any,
    getAnimeRelations: notImplemented('getAnimeRelations') as any,
    getTopAnime: notImplemented('getTopAnime') as any,
    getSeasonalAnime: notImplemented('getSeasonalAnime') as any,
    getUpcomingAnime: notImplemented('getUpcomingAnime') as any,
    getHistoricalAnime: notImplemented('getHistoricalAnime') as any,
    ...impl,
  };
}

beforeEach(() => {
  _resetProviderHealthForTests();
});

describe('createFailoverProvider — getAnime', () => {
  test('primary success: no failover, primary served it', async () => {
    const primary = makeAdapter('anilist', { getAnime: async () => fakeAnime({ externalSource: 'anilist' }) });
    const secondary = makeAdapter('jikan', { getAnime: async () => fakeAnime({ externalSource: 'mal' }) });
    const failover = createFailoverProvider(primary, [secondary]);

    const result = await failover.getAnime('1');
    assert.equal(result?.externalSource, 'anilist');

    const health = getProviderHealthSnapshot();
    assert.equal(health.recentFailoverEvents.length, 0);
    assert.equal(health.adapters.find((a) => a.provider === 'anilist')?.successCount, 1);
  });

  test('primary throws: falls over to secondary, records a failover event', async () => {
    const primary = makeAdapter('anilist', {
      getAnime: async () => {
        throw new Error('AniList is down');
      },
    });
    const secondary = makeAdapter('jikan', { getAnime: async () => fakeAnime({ externalSource: 'mal' }) });
    const failover = createFailoverProvider(primary, [secondary]);

    const result = await failover.getAnime('1');
    assert.equal(result?.externalSource, 'mal');

    const health = getProviderHealthSnapshot();
    assert.equal(health.recentFailoverEvents.length, 1);
    assert.equal(health.recentFailoverEvents[0].fromProvider, 'anilist');
    assert.equal(health.recentFailoverEvents[0].toProvider, 'jikan');
    assert.equal(health.recentFailoverEvents[0].reason, 'error');
    assert.equal(health.adapters.find((a) => a.provider === 'anilist')?.failureCount, 1);
    assert.equal(health.adapters.find((a) => a.provider === 'jikan')?.successCount, 1);
  });

  test('primary times out: falls over (timeout reason), without waiting past the deadline', async () => {
    const primary = makeAdapter('anilist', {
      getAnime: () => new Promise(() => {}), // never resolves
    });
    const secondary = makeAdapter('jikan', { getAnime: async () => fakeAnime({ externalSource: 'mal' }) });
    const failover = createFailoverProvider(primary, [secondary]);

    const start = Date.now();
    const result = await failover.getAnime('1');
    const elapsed = Date.now() - start;

    assert.equal(result?.externalSource, 'mal');
    const timeoutMs = getProviderTimeoutMs();
    assert.ok(elapsed < timeoutMs + 2000, `expected to fail over around the ${timeoutMs}ms timeout, took ${elapsed}ms`);
    assert.equal(getProviderHealthSnapshot().recentFailoverEvents[0].reason, 'timeout');
  });

  test('missing title/synopsis triggers failover even though the call itself succeeded', async () => {
    const primary = makeAdapter('anilist', { getAnime: async () => fakeAnime({ title: '', synopsis: '' }) });
    const secondary = makeAdapter('jikan', { getAnime: async () => fakeAnime({ externalSource: 'mal', title: 'Real Title' }) });
    const failover = createFailoverProvider(primary, [secondary]);

    const result = await failover.getAnime('1');
    assert.equal(result?.title, 'Real Title');
    assert.equal(getProviderHealthSnapshot().recentFailoverEvents[0].reason, 'incomplete');
  });

  test('every adapter fails: throws, never fabricates a result', async () => {
    const primary = makeAdapter('anilist', {
      getAnime: async () => {
        throw new Error('down');
      },
    });
    const secondary = makeAdapter('jikan', {
      getAnime: async () => {
        throw new Error('also down');
      },
    });
    const failover = createFailoverProvider(primary, [secondary]);

    await assert.rejects(failover.getAnime('1'), /also down/);
  });

  test('every adapter incomplete: returns the incomplete result rather than throwing (real-but-partial beats nothing)', async () => {
    const primary = makeAdapter('anilist', { getAnime: async () => fakeAnime({ title: '' }) });
    const secondary = makeAdapter('jikan', { getAnime: async () => fakeAnime({ externalSource: 'mal', title: '' }) });
    const failover = createFailoverProvider(primary, [secondary]);

    const result = await failover.getAnime('1');
    assert.ok(result); // not thrown, not null
    assert.equal(result?.title, '');
  });
});

describe('createFailoverProvider — empty-array triggers on episodes/characters/staff', () => {
  test('empty episodes from primary fails over; non-empty from secondary is used, tagged with the real provider', async () => {
    const primary = makeAdapter('jikan', { getAnimeEpisodes: async () => ({ episodes: [], pagination: emptyPagination }) });
    const secondary = makeAdapter('anilist', {
      getAnimeEpisodes: async () => ({ episodes: [{ number: 1, filler: false, recap: false } as ProviderEpisode], pagination: emptyPagination }),
    });
    const failover = createFailoverProvider(primary, [secondary]);

    const result = await failover.getAnimeEpisodes('1');
    assert.equal(result.episodes.length, 1);
    assert.equal(result.provider, 'anilist');
    assert.equal(getProviderHealthSnapshot().recentFailoverEvents[0].reason, 'incomplete');
  });

  test('empty characters from every adapter: returns the empty array (not thrown) — a real anime can genuinely have none', async () => {
    const primary = makeAdapter('anilist', { getAnimeCharacters: async () => [] });
    const secondary = makeAdapter('jikan', { getAnimeCharacters: async () => [] });
    const failover = createFailoverProvider(primary, [secondary]);

    const result = await failover.getAnimeCharacters('1');
    assert.deepEqual([...result], []);
    assert.equal(result.provider, 'jikan'); // the last one tried
  });

  test('relations are NOT failed over on empty — most standalone anime genuinely have none', async () => {
    let secondaryCalled = false;
    const primary = makeAdapter('anilist', { getAnimeRelations: async () => [] });
    const secondary = makeAdapter('jikan', {
      getAnimeRelations: async () => {
        secondaryCalled = true;
        return [];
      },
    });
    const failover = createFailoverProvider(primary, [secondary]);

    const result = await failover.getAnimeRelations('1');
    assert.deepEqual([...result], []);
    assert.equal(secondaryCalled, false, 'an empty relations array must not trigger a second provider call');
  });
});

describe('createFailoverProvider — provenance tagging survives array/object semantics', () => {
  test('tagged character array still behaves like a plain array', async () => {
    const chars: ProviderCharacter[] = [{ externalId: '1', name: 'A', role: 'Main', voiceActors: [] }];
    const primary = makeAdapter('anilist', { getAnimeCharacters: async () => chars });
    const failover = createFailoverProvider(primary, []);

    const result = await failover.getAnimeCharacters('1');
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), chars); // the hidden `provider` prop must not leak into JSON output
    assert.equal(result.provider, 'anilist');
  });
});
