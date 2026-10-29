import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import { GET as watchedGET, POST as watchedPOST } from '../src/app/api/anime/[id]/watched-episodes/route';

after(async () => {
  await prisma.$disconnect();
});

const p = (id: string) => ({ params: { id } });
const tick = async (as: any, animeId: string, episodeNumber: number, watched: boolean) =>
  read(await watchedPOST(request('POST', `/api/anime/${animeId}/watched-episodes`, { as, body: { episodeNumber, watched } }), p(animeId)));

describe('watched ticks, one episode at a time (anime without Episode rows)', () => {
  test('ticking episode 5 marks only 5; the library count follows; unaired / guests refused', async () => {
    const user = await createUser();
    const show = await createAnime({ status: 'Finished Airing', episodes: 12 });
    await prisma.userAnime.create({ data: { userId: user.id, animeId: show.id, status: 'PLAN_TO_WATCH' } });

    const r = await tick(user, show.id, 5, true);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.numbers, [5], 'only episode 5');
    assert.equal(r.body.episodesWatched, 1);
    assert.equal(r.body.status, 'WATCHING');

    await tick(user, show.id, 2, true);
    const off = await tick(user, show.id, 5, false);
    assert.deepEqual(off.body.numbers, [2]);
    const lib = await prisma.userAnime.findUniqueOrThrow({ where: { userId_animeId: { userId: user.id, animeId: show.id } } });
    assert.equal(lib.episodesWatched, 1);

    assert.equal((await tick(user, show.id, 13, true)).status, 409, 'beyond what aired');
    assert.equal((await tick(user, show.id, 0, true)).status, 400);
    const guest = await watchedPOST(request('POST', `/api/anime/${show.id}/watched-episodes`, { body: { episodeNumber: 1, watched: true } }), p(show.id));
    assert.equal(guest.status, 401);

    const got = await read(await watchedGET(request('GET', `/api/anime/${show.id}/watched-episodes`, { as: user }), p(show.id)));
    assert.deepEqual(got.body.numbers, [2]);
  });

  test('an old "watched up to N" count carries over as ticks 1…N on the first tick', async () => {
    const user = await createUser();
    const show = await createAnime({ status: 'Finished Airing', episodes: 12 });
    await prisma.userAnime.create({ data: { userId: user.id, animeId: show.id, status: 'WATCHING', episodesWatched: 3 } });

    const before = await read(await watchedGET(request('GET', `/api/anime/${show.id}/watched-episodes`, { as: user }), p(show.id)));
    assert.deepEqual(before.body.numbers, [1, 2, 3]);

    const r = await tick(user, show.id, 7, true);
    assert.deepEqual(r.body.numbers, [1, 2, 3, 7]);
    assert.equal(r.body.episodesWatched, 4);
  });

  test('two ticks at the same moment both stick (ep 1 then ep 2 — no tick lost)', async () => {
    const user = await createUser();
    const show = await createAnime({ status: 'Finished Airing', episodes: 12 });
    await prisma.userAnime.create({ data: { userId: user.id, animeId: show.id, status: 'PLAN_TO_WATCH' } });
    const results = await Promise.all([1, 2, 3, 4].map((n) => tick(user, show.id, n, true)));
    assert.ok(results.every((r) => r.status === 200));
    const got = await read(await watchedGET(request('GET', `/api/anime/${show.id}/watched-episodes`, { as: user }), p(show.id)));
    assert.deepEqual(got.body.numbers, [1, 2, 3, 4]);
    // The last reply to finish already includes every tick.
    assert.ok(results.some((r) => r.body.numbers.length === 4));
    const lib = await prisma.userAnime.findUniqueOrThrow({ where: { userId_animeId: { userId: user.id, animeId: show.id } } });
    assert.equal(lib.episodesWatched, 4);
  });

  test('ticking never adds the anime to the library', async () => {
    const user = await createUser();
    const show = await createAnime({ status: 'Finished Airing', episodes: 12 });
    const r = await tick(user, show.id, 1, true);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.numbers, [1], 'the tick itself is saved');
    assert.equal(r.body.inLibrary, false);
    assert.equal(await prisma.userAnime.count({ where: { userId: user.id, animeId: show.id } }), 0);
  });

  test('ticking every episode completes the show', async () => {
    const user = await createUser();
    const show = await createAnime({ status: 'Finished Airing', episodes: 2 });
    await prisma.userAnime.create({ data: { userId: user.id, animeId: show.id, status: 'PLAN_TO_WATCH' } });
    await tick(user, show.id, 1, true);
    const r = await tick(user, show.id, 2, true);
    assert.equal(r.body.status, 'COMPLETED');
  });
});
