/**
 * CacheManager: single-flight coalescing and stale-while-revalidate.
 * Pure L1 behavior — no DB/Redis needed (L2 is best-effort and every
 * assertion here only depends on what's synchronously visible in L1),
 * so this deliberately doesn't import helpers/setupTestDb.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CacheManager, CATALOG_CACHE_TTL_SECONDS } from '../src/lib/performance/cacheManager';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('CacheManager: original synchronous API is unchanged', () => {
  test('get/set/invalidate/invalidateTag/clearAll/getMetrics behave exactly as before', () => {
    CacheManager.clearAll();
    const key = `plain:${Date.now()}`;
    assert.equal(CacheManager.get(key), null);

    CacheManager.set(key, { v: 1 }, 60, ['tag:x']);
    assert.deepEqual(CacheManager.get(key), { v: 1 });

    const purged = CacheManager.invalidateTag('tag:x');
    assert.equal(purged, 1);
    assert.equal(CacheManager.get(key), null);

    const metrics = CacheManager.getMetrics();
    assert.equal(typeof metrics.hits, 'number');
    assert.equal(typeof metrics.misses, 'number');
    assert.equal(typeof metrics.hitRatio, 'number');
  });

  test('expired entries are evicted on read, same as before', async () => {
    const key = `expiring:${Date.now()}`;
    CacheManager.set(key, 'v', 0); // ttlSeconds=0: expires immediately
    await delay(5);
    assert.equal(CacheManager.get(key), null);
  });
});

describe('CacheManager: single-flight coalescing', () => {
  test('concurrent getOrSet misses for the same key trigger exactly one factory call', async () => {
    const key = `coalesce:${Date.now()}`;
    let calls = 0;
    const factory = async () => {
      calls++;
      await delay(30);
      return { calls };
    };

    const [a, b, c] = await Promise.all([
      CacheManager.getOrSet(key, factory, 60),
      CacheManager.getOrSet(key, factory, 60),
      CacheManager.getOrSet(key, factory, 60),
    ]);

    assert.equal(calls, 1, 'factory should have run exactly once for 3 concurrent misses');
    assert.deepEqual(a, { calls: 1 });
    assert.deepEqual(b, { calls: 1 });
    assert.deepEqual(c, { calls: 1 });
    CacheManager.invalidate(key);
  });

  test('a slow factory failing lets a later, separate call retry (in-flight entry cleared on rejection)', async () => {
    const key = `coalesce-fail:${Date.now()}`;
    let attempt = 0;
    const flaky = async () => {
      attempt++;
      if (attempt === 1) throw new Error('boom');
      return { attempt };
    };

    await assert.rejects(CacheManager.getOrSet(key, flaky, 60));
    const result = await CacheManager.getOrSet(key, flaky, 60);
    assert.deepEqual(result, { attempt: 2 });
    CacheManager.invalidate(key);
  });
});

describe('CacheManager: stale-while-revalidate', () => {
  test('serves fresh values without touching the factory again', async () => {
    const key = `swr-fresh:${Date.now()}`;
    let calls = 0;
    const factory = async () => {
      calls++;
      return { calls };
    };

    const first = await CacheManager.getOrSetSWR(key, factory, { ttlSeconds: 10 });
    const second = await CacheManager.getOrSetSWR(key, factory, { ttlSeconds: 10 });
    assert.equal(calls, 1);
    assert.deepEqual(first, second);
    CacheManager.invalidate(key);
  });

  test('serves a stale value immediately and refreshes it in the background exactly once', async () => {
    const key = `swr-stale:${Date.now()}`;
    let calls = 0;
    const factory = async () => {
      calls++;
      await delay(20);
      return { calls };
    };

    // ttlSeconds=0 so the entry is immediately stale-but-within-grace.
    const first = await CacheManager.getOrSetSWR(key, factory, { ttlSeconds: 0, staleSeconds: 5 });
    assert.deepEqual(first, { calls: 1 });

    // Still within the grace window — should return the stale value
    // (calls:1) immediately, not block on a refetch.
    const second = await CacheManager.getOrSetSWR(key, factory, { ttlSeconds: 0, staleSeconds: 5 });
    assert.deepEqual(second, { calls: 1 }, 'a stale-but-in-grace read must return immediately without waiting on the refresh');

    // Let the background refresh (kicked off by the read above) finish.
    await delay(40);
    assert.equal(calls, 2, 'exactly one background refresh should have run');
    CacheManager.invalidate(key);
  });

  test('past the hard expiry, a read blocks on a real refetch instead of serving anything stale', async () => {
    const key = `swr-expired:${Date.now()}`;
    let calls = 0;
    const factory = async () => {
      calls++;
      return { calls };
    };

    await CacheManager.getOrSetSWR(key, factory, { ttlSeconds: 0, staleSeconds: 0 });
    await delay(5);
    const afterExpiry = await CacheManager.getOrSetSWR(key, factory, { ttlSeconds: 0, staleSeconds: 0 });
    assert.equal(calls, 2);
    assert.deepEqual(afterExpiry, { calls: 2 });
    CacheManager.invalidate(key);
  });

  test('getOrSetCatalog looks up the TTL from the category table', async () => {
    assert.equal(CATALOG_CACHE_TTL_SECONDS['anime-detail'], 3600);
    assert.equal(CATALOG_CACHE_TTL_SECONDS.schedule, 300);
    assert.equal(CATALOG_CACHE_TTL_SECONDS.news, 900);

    const key = `catalog:${Date.now()}`;
    const value = await CacheManager.getOrSetCatalog('schedule', key, async () => ({ slot: 'today' }));
    assert.deepEqual(value, { slot: 'today' });
    CacheManager.invalidate(key);
  });
});
