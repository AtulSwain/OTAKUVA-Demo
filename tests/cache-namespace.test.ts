/**
 * Guards the one property that must never regress: a personalized
 * (per-user) query result must never end up cached under a key another
 * user's request could read. No DB/Redis needed here — the enforcement
 * this tests throws before any I/O, and the static scan only reads source
 * files — so this deliberately doesn't import helpers/setupTestDb.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { CacheManager } from '../src/lib/performance/cacheManager';

describe('CacheManager user/public cache-key namespace isolation', () => {
  test('userKey() always produces a key in the reserved "user:" namespace', () => {
    assert.equal(CacheManager.userKey('u1', 'feed'), 'user:u1:feed');
    assert.ok(CacheManager.isUserScopedKey(CacheManager.userKey('u1', 'feed')));
    assert.ok(!CacheManager.isUserScopedKey('anime:detail:123'));
  });

  test('userKey() refuses an empty userId (nothing should build a keyless "user:" key)', () => {
    assert.throws(() => CacheManager.userKey('', 'feed'));
  });

  test('getOrSetSWR rejects a key already in the personalized namespace', async () => {
    const key = CacheManager.userKey('u1', 'recommendations');
    let factoryCalled = false;
    await assert.rejects(
      CacheManager.getOrSetSWR(key, async () => {
        factoryCalled = true;
        return { personalized: true };
      }, { ttlSeconds: 60 }),
      /reserved "user:" .* namespace/
    );
    // The whole point: refuse before ever running the factory or writing anything.
    assert.equal(factoryCalled, false, 'factory must not run once the key is rejected');
    assert.equal(CacheManager.get(key), null, 'nothing should have been written under the rejected key');
  });

  test('getOrSetCatalog (the public-catalog entry point) rejects a personalized key the same way', async () => {
    const key = CacheManager.userKey('u2', 'watchlist');
    await assert.rejects(
      CacheManager.getOrSetCatalog('anime-detail', key, async () => ({ personalized: true }))
    );
    assert.equal(CacheManager.get(key), null);
  });

  test('a plain public key is unaffected by the guard', async () => {
    const key = `anime:detail:test-${Date.now()}`;
    const result = await CacheManager.getOrSetSWR(key, async () => ({ title: 'Frieren' }), { ttlSeconds: 60 });
    assert.deepEqual(result, { title: 'Frieren' });
    CacheManager.invalidate(key);
  });

  test('getOrSetForUser namespaces and isolates per-user results from each other and from the public tier', async () => {
    const userA = await CacheManager.getOrSetForUser('userA', 'feed', async () => ({ owner: 'A' }), 60);
    const userB = await CacheManager.getOrSetForUser('userB', 'feed', async () => ({ owner: 'B' }), 60);
    assert.deepEqual(userA, { owner: 'A' });
    assert.deepEqual(userB, { owner: 'B' });
    // Each landed under its own user:<id>:feed key, visible via the plain
    // L1 get() too (proves getOrSetForUser really did route through
    // userKey(), not some other key shape).
    assert.deepEqual(CacheManager.get(CacheManager.userKey('userA', 'feed')), { owner: 'A' });
    assert.deepEqual(CacheManager.get(CacheManager.userKey('userB', 'feed')), { owner: 'B' });
    assert.equal(CacheManager.get('feed'), null, 'a bare, unnamespaced key must not have been touched');
    CacheManager.invalidate(CacheManager.userKey('userA', 'feed'));
    CacheManager.invalidate(CacheManager.userKey('userB', 'feed'));
  });
});

describe('static guard: no source file writes a personalized result to a public-namespace cache call', () => {
  // The runtime guard above only catches a key that's *already* shaped
  // like `user:<id>:...`. The more realistic mistake is a key that bakes
  // in a per-user identifier directly (e.g. `` `anime:${id}:for:${userId}` ``)
  // without ever going through userKey() — a shape the runtime guard can't
  // recognize as personalized just by looking at the string. This scans
  // every actual call site of the public-catalog cache methods
  // (getOrSetSWR / getOrSetCatalog) in src/ and fails if the key argument
  // looks like it depends on a user identity and doesn't route through
  // userKey()/getOrSetForUser() first.
  const SRC_ROOT = path.resolve(__dirname, '..', 'src');
  const PUBLIC_CACHE_CALL = /CacheManager\.(getOrSetSWR|getOrSetCatalog)\s*\(/g;
  // How much of the source, starting at the call, counts as "the key
  // argument's neighborhood" — generous enough to cover a template
  // literal or a short expression built a couple of lines up, without
  // needing a real expression parser for what's meant to be a fast,
  // approximate safety net.
  const CONTEXT_WINDOW = 300;
  const SUSPICIOUS_PERSONALIZATION_TOKENS = [
    /\buserId\b/,
    /\buser\.id\b/,
    /\bcurrentUser\b/,
    /\bsession\.user\b/,
    /\breq\.user\b/,
    /\bauthUser\b/,
  ];
  const SANCTIONED_ESCAPE_HATCHES = [/CacheManager\.userKey\s*\(/, /isUserScopedKey/, /getOrSetForUser/];

  function listTsFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...listTsFiles(full));
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  test('every getOrSetSWR/getOrSetCatalog call site in src/ is free of raw per-user identifiers', () => {
    const offenders: string[] = [];

    for (const file of listTsFiles(SRC_ROOT)) {
      // The cache manager's own source defines these methods and
      // legitimately mentions user-related identifiers in comments/guard
      // code — not a call site, skip it.
      if (file.endsWith(path.join('performance', 'cacheManager.ts'))) continue;

      const content = fs.readFileSync(file, 'utf8');
      for (const match of content.matchAll(PUBLIC_CACHE_CALL)) {
        const start = match.index ?? 0;
        const window = content.slice(start, start + CONTEXT_WINDOW);
        const looksPersonalized = SUSPICIOUS_PERSONALIZATION_TOKENS.some((re) => re.test(window));
        const hasEscapeHatch = SANCTIONED_ESCAPE_HATCHES.some((re) => re.test(window));
        if (looksPersonalized && !hasEscapeHatch) {
          const line = content.slice(0, start).split('\n').length;
          offenders.push(`${path.relative(SRC_ROOT, file)}:${line}`);
        }
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Found ${offenders.length} call site(s) that pass a public-catalog cache key built from what looks like a per-user identifier: ${offenders.join(', ')}. ` +
        `Use CacheManager.getOrSetForUser() for anything that depends on which user is asking.`
    );
  });
});
