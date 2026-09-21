import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TIERS, TOP_TIER, tierFor, nextTier, progressToNext, getTier } from '../src/lib/badges/tiers';

describe('tier config', () => {
  test('nine tiers, ascending thresholds, unique keys/kanji-free of metal names', () => {
    assert.equal(TIERS.length, 9);
    for (let i = 1; i < TIERS.length; i++) assert.ok(TIERS[i].min > TIERS[i - 1].min);
    assert.equal(new Set(TIERS.map((t) => t.key)).size, 9);
    assert.ok(!TIERS.some((t) => /silver|gold|platinum/i.test(t.name + t.key)));
  });
  test('thresholds match the product ladder', () => {
    assert.deepEqual(TIERS.map((t) => t.min), [0, 10, 100, 200, 300, 500, 700, 1000, 1500]);
  });
});

describe('tierFor', () => {
  test('boundaries', () => {
    assert.equal(tierFor(0).key, 'shoshinsha');
    assert.equal(tierFor(9).key, 'shoshinsha');
    assert.equal(tierFor(10).key, 'kohai');
    assert.equal(tierFor(99).key, 'kohai');
    assert.equal(tierFor(100).key, 'senpai');
    assert.equal(tierFor(1499).key, 'meijin');
    assert.equal(tierFor(1500).key, 'densetsu');
    assert.equal(tierFor(99999).key, 'densetsu');
  });
  test('clamps bad input', () => {
    assert.equal(tierFor(-5).key, 'shoshinsha');
    assert.equal(tierFor(NaN).key, 'shoshinsha');
  });
});

describe('nextTier', () => {
  test('next up, and null at the top', () => {
    assert.equal(nextTier(0)?.key, 'kohai');
    assert.equal(nextTier(9)?.key, 'kohai');
    assert.equal(nextTier(10)?.key, 'senpai');
    assert.equal(nextTier(532)?.key, 'tatsujin');
    assert.equal(nextTier(1500), null);
  });
});

describe('progressToNext', () => {
  test('yuki_watches: 532 reviews is Sensei, 168 to Tatsujin', () => {
    const p = progressToNext(532);
    assert.equal(p.current.key, 'sensei');
    assert.equal(p.next?.key, 'tatsujin');
    assert.equal(p.remaining, 168);
    assert.ok(Math.abs(p.fraction - 32 / 200) < 1e-9);
  });
  test('fraction is 0 exactly at a threshold and just under 1 before the next', () => {
    assert.equal(progressToNext(100).fraction, 0);
    assert.ok(progressToNext(199).fraction < 1);
    assert.equal(progressToNext(199).remaining, 1);
  });
  test('top tier has no next and a full bar', () => {
    const p = progressToNext(2000);
    assert.equal(p.current.key, TOP_TIER.key);
    assert.equal(p.next, null);
    assert.equal(p.remaining, 0);
    assert.equal(p.fraction, 1);
  });
  test('getTier falls back to the beginner tier', () => {
    assert.equal(getTier('nope').key, 'shoshinsha');
  });
});
