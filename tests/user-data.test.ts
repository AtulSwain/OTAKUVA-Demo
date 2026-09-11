import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createEpisode, createUser } from './helpers/fixtures';

import { GET as libraryGET } from '../src/app/api/library/route';
import { PATCH as libraryPATCH, DELETE as libraryDELETE } from '../src/app/api/library/[animeId]/route';
import { POST as ratingPOST } from '../src/app/api/anime/[id]/rating/route';
import { GET as ratingSummaryGET } from '../src/app/api/anime/[id]/rating-summary/route';
import { POST as progressPOST } from '../src/app/api/anime/[id]/episodes/[episodeId]/progress/route';
import { POST as markAllPOST } from '../src/app/api/anime/[id]/episodes/mark-all-watched/route';
import { GET as episodesGET } from '../src/app/api/anime/[id]/episodes/route';
import { markEpisodeCompleted, isStillAiring } from '../src/lib/engine/watch/watchEngine';

after(async () => {
  await prisma.$disconnect();
});

const libraryIds = async (as: any) => {
  const res = await read(await libraryGET(request('GET', '/api/library', { as })));
  const items = res.body.items ?? res.body.data?.items ?? [];
  return items.map((i: any) => i.animeId ?? i.id);
};

describe('library', () => {
  test('persists across sessions and never leaks to another user', async () => {
    const alice = await createUser();
    const bob = await createUser();
    const anime = await createAnime();

    const added = await libraryPATCH(
      request('PATCH', `/api/library/${anime.slug}`, { as: alice, body: { status: 'PLAN_TO_WATCH' } }),
      { params: { animeId: anime.slug } }
    );
    assert.equal(added.status, 200);

    // A fresh token for the same user stands in for logout/login; the entry
    // is server state, not client state.
    assert.ok((await libraryIds(alice)).includes(anime.id));
    assert.ok(!(await libraryIds(bob)).includes(anime.id));

    // Bob cannot remove Alice's entry: his DELETE only ever touches his own rows.
    await libraryDELETE(request('DELETE', `/api/library/${anime.slug}`, { as: bob }), { params: { animeId: anime.slug } });
    assert.ok((await libraryIds(alice)).includes(anime.id));
  });

  test('marking COMPLETED persists (finishDate is a real DateTime)', async () => {
    const user = await createUser();
    const anime = await createAnime({ episodes: 1, status: 'Finished Airing' });
    const res = await libraryPATCH(
      request('PATCH', `/api/library/${anime.id}`, { as: user, body: { status: 'COMPLETED' } }),
      { params: { animeId: anime.id } }
    );
    assert.equal(res.status, 200);
    const row = await prisma.userAnime.findUnique({ where: { userId_animeId: { userId: user.id, animeId: anime.id } } });
    assert.equal(row?.status, 'COMPLETED');
    assert.ok(row?.finishDate instanceof Date);
  });

  test('(userId, animeId) is unique in the database itself', async () => {
    const user = await createUser();
    const anime = await createAnime();
    await prisma.userAnime.create({ data: { userId: user.id, animeId: anime.id, status: 'WATCHING' } });
    await assert.rejects(prisma.userAnime.create({ data: { userId: user.id, animeId: anime.id, status: 'DROPPED' } }));
  });
});

describe('ratings', () => {
  test('a user rating never overwrites the provider score, and one user has one rating', async () => {
    const user = await createUser();
    const anime = await createAnime({ score: 8.4, scoredBy: 2_386_842 });

    for (const score of [3, 9.5]) {
      const res = await ratingPOST(
        request('POST', `/api/anime/${anime.id}/rating`, { as: user, body: { score } }),
        { params: { id: anime.id } }
      );
      assert.equal(res.status, 200);
    }

    const after = await prisma.anime.findUniqueOrThrow({ where: { id: anime.id } });
    assert.equal(after.score, 8.4, 'provider score untouched');
    assert.equal(after.scoredBy, 2_386_842);
    assert.equal(await prisma.animeRating.count({ where: { userId: user.id, animeId: anime.id } }), 1);

    const summary = await read(await ratingSummaryGET(request('GET', `/api/anime/${anime.id}/rating-summary`), { params: { id: anime.id } }));
    assert.equal(summary.status, 200);
    assert.equal(summary.body.ratingCount, 1);
    assert.equal(summary.body.rawAverage, 9.5);

    // Reading the summary is not a write to the anime.
    const again = await prisma.anime.findUniqueOrThrow({ where: { id: anime.id } });
    assert.equal(again.score, 8.4);
  });

  test('the OTAKUVA score shown on the anime page is what members rated', async () => {
    // The hero reads RatingSummary.rawAverage; a single rating of 9 must read
    // as 9.0 from 1 rating, not the ranking-smoothed ~7.6.
    const [first, second] = [await createUser(), await createUser()];
    const anime = await createAnime({ score: 6.1, scoredBy: 1000 });
    const rate = (as: any, score: number) =>
      ratingPOST(request('POST', `/api/anime/${anime.id}/rating`, { as, body: { score } }), { params: { id: anime.id } });
    const summary = async () =>
      (await read(await ratingSummaryGET(request('GET', `/api/anime/${anime.id}/rating-summary`), { params: { id: anime.id } }))).body;

    await rate(first, 9);
    let s = await summary();
    assert.equal(s.rawAverage, 9);
    assert.equal(s.ratingCount, 1);

    await rate(second, 7);
    s = await summary();
    assert.equal(s.rawAverage, 8, 'average of 9 and 7');
    assert.equal(s.ratingCount, 2);
  });

  test('removing an anime from the library stops its rating counting', async () => {
    const user = await createUser();
    const anime = await createAnime();
    await ratingPOST(request('POST', `/api/anime/${anime.id}/rating`, { as: user, body: { score: 7 } }), { params: { id: anime.id } });
    await libraryPATCH(request('PATCH', `/api/library/${anime.id}`, { as: user, body: { status: 'WATCHING' } }), { params: { animeId: anime.id } });
    await libraryDELETE(request('DELETE', `/api/library/${anime.id}`, { as: user }), { params: { animeId: anime.id } });
    // Recalculation is fire-and-forget in the route; give it a moment.
    await new Promise((r) => setTimeout(r, 300));
    const agg = await prisma.ratingAggregate.findUnique({ where: { animeId: anime.id } });
    assert.equal(agg?.ratingCount, 0);
  });

  test('review uniqueness is enforced by the database', async () => {
    const user = await createUser();
    const anime = await createAnime();
    const data = { userId: user.id, animeId: anime.id, title: 'One', body: 'Review body text' };
    await prisma.review.create({ data });
    await assert.rejects(prisma.review.create({ data: { ...data, title: 'Two' } }));
  });
});

describe('episode tracking', () => {
  test('progress is unique per (user, episode) and cannot target another anime’s episode', async () => {
    const user = await createUser();
    const a = await createAnime({ episodes: 2, status: 'Finished Airing' });
    const b = await createAnime();
    const epA1 = await createEpisode(a.id, 1, new Date('2020-01-01'));
    const epB1 = await createEpisode(b.id, 1, new Date('2020-01-01'));

    const mark = (animeId: string, episodeId: string, body: any = { status: 'WATCHED' }) =>
      progressPOST(request('POST', `/api/anime/${animeId}/episodes/${episodeId}/progress`, { as: user, body }), {
        params: { id: animeId, episodeId },
      });

    assert.equal((await mark(a.id, epA1.id)).status, 200);
    assert.equal((await mark(a.id, epA1.id)).status, 200);
    assert.equal(await prisma.userEpisodeProgress.count({ where: { userId: user.id, episodeId: epA1.id } }), 1);

    assert.equal((await mark(a.id, epB1.id)).status, 404, 'episode belongs to a different anime');
  });

  test('a client-supplied episode number never creates a catalog episode', async () => {
    const user = await createUser();
    const anime = await createAnime();
    const res = await progressPOST(
      request('POST', `/api/anime/${anime.id}/episodes/nope/progress`, { as: user, body: { status: 'WATCHED', episodeNumber: 99999 } }),
      { params: { id: anime.id, episodeId: 'nope' } }
    );
    assert.equal(res.status, 404);
    await assert.rejects(markEpisodeCompleted({ userId: user.id, animeId: anime.id, episodeNumber: 5 } as any), /Episode not found/);
    assert.equal(await prisma.episode.count({ where: { animeId: anime.id } }), 0);

    const all = await markAllPOST(request('POST', `/api/anime/${anime.id}/episodes/mark-all-watched`, { as: user }), { params: { id: anime.id } });
    assert.equal(all.status, 409);
    assert.equal(await prisma.episode.count({ where: { animeId: anime.id } }), 0, 'no placeholder episodes invented');
  });

  test('an airing show is not completed by watching every released episode', async () => {
    assert.equal(isStillAiring('Currently Airing'), true);
    assert.equal(isStillAiring('RELEASING'), true);
    assert.equal(isStillAiring('Not yet aired'), true);
    assert.equal(isStillAiring('Finished Airing'), false);

    const user = await createUser();
    const anime = await createAnime({ episodes: 2, status: 'Currently Airing' });
    await createEpisode(anime.id, 1, new Date('2026-01-01'));
    await createEpisode(anime.id, 2, new Date('2026-01-08'));
    await createEpisode(anime.id, 3, new Date(Date.now() + 7 * 86_400_000)); // not aired yet

    const res = await markAllPOST(request('POST', `/api/anime/${anime.id}/episodes/mark-all-watched`, { as: user }), { params: { id: anime.id } });
    assert.equal(res.status, 200);
    const entry = await prisma.userAnime.findUnique({ where: { userId_animeId: { userId: user.id, animeId: anime.id } } });
    assert.equal(entry?.status, 'WATCHING');
    assert.equal(entry?.episodesWatched, 2, 'the unaired episode is not marked');
  });

  test('next episode is the lowest unwatched released episode, not progress + 1', async () => {
    const user = await createUser();
    const anime = await createAnime({ episodes: 4, status: 'Finished Airing' });
    const eps = [];
    for (let n = 1; n <= 4; n++) eps.push(await createEpisode(anime.id, n, new Date(`2020-01-0${n}`)));
    // Watched 1, 2 and 4 — progress + 1 would say 4; the right answer is 3.
    for (const ep of [eps[0], eps[1], eps[3]]) {
      await progressPOST(request('POST', `/api/anime/${anime.id}/episodes/${ep.id}/progress`, { as: user, body: { status: 'WATCHED' } }), {
        params: { id: anime.id, episodeId: ep.id },
      });
    }
    const res = await read(await episodesGET(request('GET', `/api/anime/${anime.id}/episodes?limit=1`, { as: user }), { params: { id: anime.id } }));
    assert.equal(res.body.progress.nextUnwatchedEpisodeNumber, 3);
  });
});
