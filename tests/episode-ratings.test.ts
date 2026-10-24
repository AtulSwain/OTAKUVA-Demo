import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import { GET as epGET, POST as epPOST, DELETE as epDELETE } from '../src/app/api/anime/[id]/episode-ratings/route';
import { GET as rateGET, POST as ratePOST } from '../src/app/api/anime/[id]/rating/route';
import { POST as reviewPOST } from '../src/app/api/reviews/route';
import { getEpisodeReleaseState } from '../src/lib/rating/episodeRatings';
import { getReviewerRatings } from '../src/lib/reviews/reviewerRatings';

after(async () => {
  await prisma.$disconnect();
});

const HOUR = 3_600_000;
const p = (id: string) => ({ params: { id } });
const rateEp = async (as: any, animeId: string, body: Record<string, unknown>) =>
  read(await epPOST(request('POST', `/api/anime/${animeId}/episode-ratings`, { as, body }), p(animeId)));
/** Retention needs the episode marked watched first (2026-10-21). */
const watched = (user: { id: string }, animeId: string, ...ns: number[]) =>
  prisma.userEpisodeWatch.createMany({ data: ns.map((episodeNumber) => ({ userId: user.id, animeId, episodeNumber })), skipDuplicates: true });

describe('which episodes have aired', () => {
  test('finished show: every episode up to its official count; movie: one', async () => {
    const show = await createAnime({ status: 'Finished Airing', episodes: 12, type: 'TV' });
    assert.equal((await getEpisodeReleaseState(show.id)).released, 12);
    const movie = await createAnime({ status: 'Finished', type: 'Movie', episodes: null });
    assert.equal((await getEpisodeReleaseState(movie.id)).released, 1);
  });

  test('airing show: aired schedule entries count, the next one does not', async () => {
    const show = await createAnime({ status: 'Currently Airing', episodes: 12 });
    const now = Date.now();
    await prisma.airingSchedule.createMany({
      data: [
        { animeId: show.id, episode: 1, airingAt: new Date(now - 14 * 24 * HOUR) },
        { animeId: show.id, episode: 2, airingAt: new Date(now - 7 * 24 * HOUR) },
        { animeId: show.id, episode: 3, airingAt: new Date(now + 2 * HOUR) },
      ],
    });
    const s = await getEpisodeReleaseState(show.id);
    assert.equal(s.released, 2);
    assert.equal(s.next?.number, 3);
    assert.equal(s.isOpen, true);
  });

  test('upcoming show: locked', async () => {
    const show = await createAnime({ status: 'Not yet aired', episodes: 12 });
    const s = await getEpisodeReleaseState(show.id);
    assert.equal(s.released, 0);
    assert.equal(s.isOpen, false);
  });
});

describe('rating episodes', () => {
  test('only aired episodes can be rated; nothing (rating, overall, review) before episode 1', async () => {
    const user = await createUser();
    const airing = await createAnime({ status: 'Currently Airing', episodes: 12 });
    await prisma.airingSchedule.create({ data: { animeId: airing.id, episode: 1, airingAt: new Date(Date.now() - HOUR) } });
    assert.equal((await rateEp(user, airing.id, { episodeNumber: 1, score: 8 })).status, 200);
    const tooEarly = await rateEp(user, airing.id, { episodeNumber: 2, score: 8 });
    assert.equal(tooEarly.status, 403);
    assert.match(tooEarly.body.error, /hasn't aired/);

    const upcoming = await createAnime({ status: 'Not yet aired', episodes: 12 });
    assert.equal((await rateEp(user, upcoming.id, { episodeNumber: 1, score: 8 })).status, 403);
    const overall = await ratePOST(request('POST', `/api/anime/${upcoming.id}/rating`, { as: user, body: { score: 8 } }), p(upcoming.id));
    assert.equal(overall.status, 403);
    const review = await reviewPOST(request('POST', '/api/reviews', { as: user, body: { animeId: upcoming.id, body: 'Long enough review body for the check.' } }));
    assert.equal(review.status, 403);
  });

  test('scores use 0.1 steps; aspects are optional and validated; guests are refused', async () => {
    const user = await createUser();
    const show = await createAnime({ status: 'Currently Airing', episodes: 3 });
    assert.equal((await rateEp(user, show.id, { episodeNumber: 1, score: 7.35 })).status, 400);
    assert.equal((await rateEp(user, show.id, { episodeNumber: 1, score: 8, categoryScores: { STORY: 11 } })).status, 400);
    const ok = await rateEp(user, show.id, { episodeNumber: 1, score: 8, categoryScores: { STORY: 9, MUSIC: 7.5 }, note: '  Great opener ' });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.rating.categoryScores, { STORY: 9, MUSIC: 7.5 });
    assert.equal(ok.body.rating.note, 'Great opener');
    assert.equal((await epPOST(request('POST', `/api/anime/${show.id}/episode-ratings`, { body: { episodeNumber: 1, score: 8 } }), p(show.id))).status, 401);
  });
});

describe('anime score vs episode retention (2026-10-20)', () => {
  test("the anime's own rating is the member's score; legacy episode scores only count without one", async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    const show = await createAnime({ status: 'Currently Airing', episodes: 12, nextAiringEpisode: 4, nextAiringAt: new Date(Date.now() + 24 * HOUR) });
    // a: legacy episode scores (avg 8), then rates the anime itself 9.5 — the anime rating wins.
    await rateEp(a, show.id, { episodeNumber: 1, score: 7, categoryScores: { STORY: 8 } });
    await rateEp(a, show.id, { episodeNumber: 2, score: 9 });
    assert.equal((await ratePOST(request('POST', `/api/anime/${show.id}/rating`, { as: a, body: { score: 9.5, categoryScores: { STORY: 9 } } }), p(show.id))).status, 200, 'airing shows take an overall rating');
    // b: only legacy episode scores — still counted (avg 6).
    await rateEp(b, show.id, { episodeNumber: 1, score: 6 });
    // c: only retention — never counts toward the anime score.
    await watched(c, show.id, 1);
    assert.equal((await rateEp(c, show.id, { episodeNumber: 1, retention: 90 })).status, 200);

    const agg = await prisma.ratingAggregate.findUniqueOrThrow({ where: { animeId: show.id } });
    assert.equal(agg.ratingCount, 2, 'a and b; retention-only c is not a score');
    assert.equal(agg.rawAverage, 7.75, '(9.5 + 6) / 2');

    const shown = await getReviewerRatings([{ userId: a.id, animeId: show.id }, { userId: b.id, animeId: show.id }, { userId: c.id, animeId: show.id }]);
    assert.equal(shown.get(`${a.id}:${show.id}`), 9.5);
    assert.equal(shown.get(`${b.id}:${show.id}`), 6);
    assert.equal(shown.get(`${c.id}:${show.id}`), undefined);

    const mine = (await read(await rateGET(request('GET', `/api/anime/${show.id}/rating`, { as: a }), p(show.id)))).body;
    assert.equal(mine.yourRating, 9.5);
    assert.equal(mine.source, 'overall');
  });

  test('retention: 0–100 in steps of 5, aired episodes only, any show; averaged per episode', async () => {
    const a = await createUser();
    const b = await createUser();
    const show = await createAnime({ status: 'Finished Airing', episodes: 3 });
    await watched(a, show.id, 1, 2);
    await watched(b, show.id, 1, 2);
    assert.equal((await rateEp(a, show.id, { episodeNumber: 1, retention: 93 })).status, 400);
    assert.equal((await rateEp(a, show.id, { episodeNumber: 1, retention: 120 })).status, 400);
    assert.equal((await rateEp(a, show.id, { episodeNumber: 4, retention: 50 })).status, 403, 'only 3 episodes exist');
    assert.equal((await rateEp(a, show.id, { episodeNumber: 1, retention: 90 })).status, 200, 'finished shows can be rated by episode too');
    await rateEp(a, show.id, { episodeNumber: 2, retention: 60 });
    await rateEp(b, show.id, { episodeNumber: 1, retention: 70 });

    const summary = (await read(await epGET(request('GET', `/api/anime/${show.id}/episode-ratings`, { as: a }), p(show.id)))).body;
    assert.deepEqual(summary.episodes.map((e: any) => [e.number, e.retention, e.retentionCount]), [[1, 80, 2], [2, 60, 1], [3, null, 0]]);
    assert.equal(summary.mine[1].retention, 90);
    assert.equal(summary.mine[2].retention, 60);

    // Removing retention leaves a legacy score on the same row alone.
    await rateEp(b, show.id, { episodeNumber: 2, score: 7 });
    await rateEp(b, show.id, { episodeNumber: 2, retention: 40 });
    const del = await epDELETE(request('DELETE', `/api/anime/${show.id}/episode-ratings?episodeNumber=2&what=retention`, { as: b }), p(show.id));
    assert.equal(del.status, 200);
    const row = await prisma.episodeRating.findFirstOrThrow({ where: { userId: b.id, animeId: show.id, episodeNumber: 2 } });
    assert.equal(row.retention, null);
    assert.equal(row.rating, 7);
    const del2 = await epDELETE(request('DELETE', `/api/anime/${show.id}/episode-ratings?episodeNumber=1&what=retention`, { as: a }), p(show.id));
    assert.equal(del2.status, 200);
    assert.equal(await prisma.episodeRating.count({ where: { userId: a.id, animeId: show.id, episodeNumber: 1 } }), 0, 'retention-only row is removed');
  });
});

describe('retention only after marking the episode watched (2026-10-21)', () => {
  test('refused until watched; a tick, episode progress or an old "up to N" count unlocks it', async () => {
    const [u, v] = await Promise.all([createUser(), createUser()]);
    const show = await createAnime({ status: 'Finished Airing', episodes: 12 });

    const blocked = await rateEp(u, show.id, { episodeNumber: 2, retention: 70 });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, 'EPISODE_NOT_WATCHED');

    await watched(u, show.id, 2);
    assert.equal((await rateEp(u, show.id, { episodeNumber: 2, retention: 70 })).status, 200);
    assert.equal((await rateEp(u, show.id, { episodeNumber: 3, retention: 70 })).status, 409, 'only the watched episode');

    // Old "watched up to 4" library count, no per-episode ticks yet: 1–4 count as watched.
    await prisma.userAnime.create({ data: { userId: v.id, animeId: show.id, status: 'WATCHING', episodesWatched: 4 } });
    assert.equal((await rateEp(v, show.id, { episodeNumber: 4, retention: 50 })).status, 200);
    assert.equal((await rateEp(v, show.id, { episodeNumber: 5, retention: 50 })).status, 409);
  });
});

describe('premiere unlock + anime retention totals', () => {
  test('a "Not yet aired" show opens the moment episode 1\'s scheduled time passes', async () => {
    const user = await createUser();
    const future = await createAnime({ status: 'Not yet aired', episodes: 12 });
    await prisma.airingSchedule.create({ data: { animeId: future.id, episode: 1, airingAt: new Date(Date.now() + HOUR) } });
    assert.equal((await getEpisodeReleaseState(future.id)).isOpen, false);

    const justAired = await createAnime({ status: 'Not yet aired', episodes: 12 });
    await prisma.airingSchedule.create({ data: { animeId: justAired.id, episode: 1, airingAt: new Date(Date.now() - 60_000) } });
    const s = await getEpisodeReleaseState(justAired.id);
    assert.equal(s.isOpen, true, 'status still says "Not yet aired" but the air time has passed');
    assert.equal(s.released, 1);
    assert.equal((await ratePOST(request('POST', `/api/anime/${justAired.id}/rating`, { as: user, body: { score: 8 } }), p(justAired.id))).status, 200);

    const viaNext = await createAnime({ status: 'Not yet aired', episodes: 12, nextAiringEpisode: 1, nextAiringAt: new Date(Date.now() - 60_000) });
    assert.equal((await getEpisodeReleaseState(viaNext.id)).released, 1, 'nextAiringAt in the past counts too');
  });

  test('anime retention: each member once (their episode average); the viewer sees their own total', async () => {
    const a = await createUser();
    const b = await createUser();
    const show = await createAnime({ status: 'Finished Airing', episodes: 4 });
    await watched(a, show.id, 1, 2, 3);
    await watched(b, show.id, 1);
    await rateEp(a, show.id, { episodeNumber: 1, retention: 90 });
    await rateEp(a, show.id, { episodeNumber: 2, retention: 60 });
    await rateEp(a, show.id, { episodeNumber: 3, retention: 75 }); // a = 75
    await rateEp(b, show.id, { episodeNumber: 1, retention: 55 }); // b = 55
    const summary = (await read(await epGET(request('GET', `/api/anime/${show.id}/episode-ratings`, { as: a }), p(show.id)))).body;
    assert.deepEqual(summary.retention, { value: 65, members: 2 }, '(75 + 55) / 2, not the average of 4 rows');
    assert.deepEqual(summary.myRetention, { value: 75, episodes: 3 });
  });
});
