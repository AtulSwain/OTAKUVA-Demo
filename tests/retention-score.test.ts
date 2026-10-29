import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import { GET as epGET, POST as epPOST } from '../src/app/api/anime/[id]/episode-ratings/route';
import { GET as scoresGET } from '../src/app/api/anime/community-scores/route';
import { GET as rankingsGET } from '../src/app/api/rankings/retention/route';
import {
  computeAnimeRetention,
  isValidRetention,
  requiredRatedEpisodes,
  retentionBadgeFor,
} from '../src/lib/rating/retentionScore';

after(async () => {
  await prisma.$disconnect();
});

const p = (id: string) => ({ params: { id } });
const rate = async (as: any, animeId: string, episodeNumber: number, retention: unknown) =>
  read(await epPOST(request('POST', `/api/anime/${animeId}/episode-ratings`, { as, body: { episodeNumber, retention } }), p(animeId)));
const summaryOf = async (animeId: string, as?: any) =>
  (await read(await epGET(request('GET', `/api/anime/${animeId}/episode-ratings`, as ? { as } : {}), p(animeId)))).body;
const watched = (user: { id: string }, animeId: string, ...ns: number[]) =>
  prisma.userEpisodeWatch.createMany({ data: ns.map((episodeNumber) => ({ userId: user.id, animeId, episodeNumber })), skipDuplicates: true });
/** n episodes' rating totals for the pure calculator. */
const eps = (...lists: number[][]) => lists.map((l, i) => ({ number: i + 1, sum: l.reduce((a, b) => a + b, 0), count: l.length }));

describe('retention maths (pure)', () => {
  test('badge thresholds use the raw, unrounded score', () => {
    const cases: [number, string][] = [
      [1, 'DROPPED'], [19, 'DROPPED'], [19.99, 'DROPPED'],
      [20, 'SLEEPER'], [39, 'SLEEPER'], [39.99, 'SLEEPER'],
      [40, 'SOLID'], [69, 'SOLID'], [69.99, 'SOLID'],
      [70, 'PEAKING'], [89, 'PEAKING'], [89.6, 'PEAKING'],
      [90, 'HOOKED'], [100, 'HOOKED'],
    ];
    for (const [raw, key] of cases) assert.equal(retentionBadgeFor(raw).key, key, `${raw} → ${key}`);
  });

  test('89.6 displays as 90% but stays PEAKING', () => {
    // Episodes 89, 90 and 89.8 average to 89.6.
    const r = computeAnimeRetention([{ number: 1, sum: 89, count: 1 }, { number: 2, sum: 90, count: 1 }, { number: 3, sum: 89.8, count: 1 }], 3, 12);
    assert.ok(Math.abs((r.raw ?? 0) - 89.6) < 1e-9);
    assert.equal(r.value, 90);
    assert.equal(r.badge, 'PEAKING');
  });

  test('valid ratings: whole numbers 1–100 only', () => {
    for (const ok of [1, 50, 100]) assert.equal(isValidRetention(ok), true);
    for (const bad of [0, 101, -5, 50.5, '80', null, undefined, NaN]) assert.equal(isValidRetention(bad), false, String(bad));
  });

  test("spec example: episodes 80, 90, 70 → anime 80", () => {
    const r = computeAnimeRetention(eps([80], [90], [70]), 3, 3);
    assert.equal(r.raw, 80);
    assert.equal(r.value, 80);
    assert.equal(r.badge, 'PEAKING');
  });

  test('average of episode scores, not of every vote', () => {
    // Episode 1: four votes of 100; episode 2: one vote of 40, episode 3: one of 70.
    const r = computeAnimeRetention(eps([100, 100, 100, 100], [40], [70]), 4, 12);
    assert.equal(r.raw, 70, '(100 + 40 + 70) / 3 — the all-votes average would be 85');
    assert.equal(r.totalRatings, 6);
  });

  test('unrated episodes are left out, never counted as 0', () => {
    const withGaps = computeAnimeRetention([...eps([80], [90], [70]), { number: 4, sum: 0, count: 0 }, { number: 5, sum: 0, count: 0 }], 3, 12);
    assert.equal(withGaps.raw, 80);
    assert.equal(withGaps.ratedEpisodes, 3);
  });

  test('not rated / provisional / rated', () => {
    const none = computeAnimeRetention([], 0, 12);
    assert.equal(none.status, 'unrated');
    assert.equal(none.value, null);
    assert.equal(none.badge, null);

    // A single great episode never earns a badge on its own.
    const one = computeAnimeRetention(eps([100, 100, 100]), 3, 12);
    assert.equal(one.status, 'provisional', 'only 1 of the 3 required episodes rated');
    assert.equal(one.badge, null);

    const fewMembers = computeAnimeRetention(eps([90], [90], [90]), 2, 12);
    assert.equal(fewMembers.status, 'provisional', 'only 2 members');

    const enough = computeAnimeRetention(eps([90], [90], [90]), 3, 12);
    assert.equal(enough.status, 'rated');
    assert.equal(enough.badge, 'HOOKED');
  });

  test('short shows need every episode rated, capped at 3', () => {
    assert.equal(requiredRatedEpisodes(1), 1);
    assert.equal(requiredRatedEpisodes(2), 2);
    assert.equal(requiredRatedEpisodes(24), 3);
    assert.equal(requiredRatedEpisodes(null), 3);
    const movie = computeAnimeRetention(eps([60, 70, 80]), 3, 1);
    assert.equal(movie.status, 'rated');
    assert.equal(movie.badge, 'PEAKING');
  });
});

describe('retention flow (API + database)', () => {
  test('submit → episode score → change without duplicates → anime score → badge', async () => {
    const show = await createAnime({ status: 'Finished Airing', episodes: 4 });
    const [a, b, c] = await Promise.all([createUser(), createUser(), createUser()]);
    await watched(a, show.id, 1, 2, 3);
    await watched(b, show.id, 1, 2, 3);
    await watched(c, show.id, 1, 2, 3);

    // 1. A member submits a rating.
    const first = await rate(a, show.id, 1, 80);
    assert.equal(first.status, 200);
    // 2. The episode's community score updates.
    assert.equal(first.body.summary.episodes[0].retention, 80);
    assert.equal(first.body.summary.episodes[0].retentionCount, 1);
    assert.equal(first.body.summary.retention.status, 'provisional');

    // 3. Same member changes it — one row, new value.
    const changed = await rate(a, show.id, 1, 60);
    assert.equal(changed.status, 200);
    assert.equal(await prisma.episodeRating.count({ where: { userId: a.id, animeId: show.id, episodeNumber: 1 } }), 1);
    assert.equal(changed.body.summary.episodes[0].retention, 60);
    assert.equal(changed.body.summary.episodes[0].retentionCount, 1);

    // More members and episodes.
    await rate(b, show.id, 1, 100); // ep1 = (60 + 100) / 2 = 80
    await rate(c, show.id, 2, 90); // ep2 = 90
    await rate(a, show.id, 3, 70); // ep3 = 70; ep4 unrated

    // 4. Anime score = (80 + 90 + 70) / 3 = 80, badge PEAKING (3 members, 3 episodes).
    const s = await summaryOf(show.id, a);
    assert.deepEqual(s.episodes.map((e: any) => [e.number, e.retention, e.retentionCount]), [[1, 80, 2], [2, 90, 1], [3, 70, 1], [4, null, 0]]);
    assert.equal(s.retention.value, 80);
    assert.equal(s.retention.raw, 80);
    assert.equal(s.retention.members, 3);
    assert.equal(s.retention.ratedEpisodes, 3);
    assert.equal(s.retention.totalRatings, 4);
    assert.equal(s.retention.status, 'rated');
    assert.equal(s.retention.badge, 'PEAKING');
    // The viewer's own figure is separate: a rated 1 → 60 and 3 → 70.
    assert.deepEqual(s.myRetention, { value: 65, episodes: 2 });

    // 5/6. Raising one episode moves the anime score; episode 4 (unrated) never pulls it down.
    await rate(c, show.id, 2, 100); // ep2 = 100 → (80 + 100 + 70) / 3 = 83.3
    const s2 = await summaryOf(show.id);
    assert.equal(s2.retention.value, 83);
    assert.equal(s2.retention.badge, 'PEAKING');

    // 8. Cards and rankings show the same numbers as the anime page.
    const cards = (await read(await scoresGET(request('GET', `/api/anime/community-scores?ids=${show.id}`)))).body.scores;
    assert.equal(cards[show.id].retention, s2.retention.value);
    assert.equal(cards[show.id].retentionStatus, 'rated');
    assert.equal(cards[show.id].retentionBadge, 'PEAKING');
    const rankings = (await read(await rankingsGET(request('GET', '/api/rankings/retention')))).body;
    const ranked = rankings.rated.find((r: any) => r.id === show.id);
    assert.ok(ranked, 'a rated title is in the ranked list');
    assert.equal(ranked.retention.value, s2.retention.value);
    assert.ok(!rankings.provisional.some((r: any) => r.id === show.id));
  });

  test('provisional titles are ranked apart; unrated titles are not listed', async () => {
    const early = await createAnime({ status: 'Finished Airing', episodes: 12 });
    const nobody = await createAnime({ status: 'Finished Airing', episodes: 12 });
    const u = await createUser();
    await watched(u, early.id, 1);
    await rate(u, early.id, 1, 95);
    const rankings = (await read(await rankingsGET(request('GET', '/api/rankings/retention')))).body;
    assert.ok(rankings.provisional.some((r: any) => r.id === early.id));
    assert.ok(!rankings.rated.some((r: any) => r.id === early.id), 'one great episode does not earn a ranked badge');
    assert.ok(![...rankings.rated, ...rankings.provisional].some((r: any) => r.id === nobody.id));
    const s = await summaryOf(nobody.id);
    assert.equal(s.retention.status, 'unrated');
    assert.equal(s.retention.value, null);
  });

  test('server validation and auth', async () => {
    const show = await createAnime({ status: 'Finished Airing', episodes: 2 });
    const u = await createUser();
    await watched(u, show.id, 1);
    for (const bad of [0, 101, 50.5, '80', null]) {
      assert.equal((await rate(u, show.id, 1, bad)).status, 400, `rejects ${JSON.stringify(bad)}`);
    }
    // Signed out: refused.
    const anon = await read(await epPOST(request('POST', `/api/anime/${show.id}/episode-ratings`, { body: { episodeNumber: 1, retention: 50 } }), p(show.id)));
    assert.equal(anon.status, 401);
    // Not watched yet: refused.
    assert.equal((await rate(u, show.id, 2, 50)).status, 409);
    // A userId in the body is ignored — ratings are always the signed-in member's own.
    const other = await createUser();
    await read(await epPOST(request('POST', `/api/anime/${show.id}/episode-ratings`, { as: u, body: { episodeNumber: 1, retention: 40, userId: other.id } }), p(show.id)));
    assert.equal(await prisma.episodeRating.count({ where: { userId: other.id } }), 0);
    assert.equal((await prisma.episodeRating.findFirstOrThrow({ where: { userId: u.id, animeId: show.id, episodeNumber: 1 } })).retention, 40);
  });

  test('double-submitting at once leaves one rating', async () => {
    const show = await createAnime({ status: 'Finished Airing', episodes: 2 });
    const u = await createUser();
    await watched(u, show.id, 1);
    const results = await Promise.all([rate(u, show.id, 1, 30), rate(u, show.id, 1, 30), rate(u, show.id, 1, 30)]);
    for (const r of results) assert.equal(r.status, 200);
    assert.equal(await prisma.episodeRating.count({ where: { userId: u.id, animeId: show.id, episodeNumber: 1 } }), 1);
  });
});
