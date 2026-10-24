import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';

import { PATCH as libraryPATCH } from '../src/app/api/library/[animeId]/route';

after(async () => {
  await prisma.$disconnect();
});

const patch = (user: any, animeId: string, body: unknown) =>
  libraryPATCH(request('PATCH', `/api/library/${animeId}`, { as: user, body }), { params: { animeId } });

// The episode guide's progress counter (for anime with no episode rows)
// saves a plain episodesWatched count — which used to be accepted unchecked.
describe('PATCH /api/library/[animeId] episodesWatched validation', () => {
  test('rejects negative, fractional, non-numeric and over-the-total counts', async () => {
    const user = await createUser();
    const anime = await createAnime({ episodes: 12 });
    for (const bad of [-1, 2.5, '3', 13]) {
      const res = await patch(user, anime.id, { episodesWatched: bad });
      assert.equal(res.status, 400, `episodesWatched=${JSON.stringify(bad)}`);
    }
    assert.equal(await prisma.userAnime.count({ where: { userId: user.id, animeId: anime.id } }), 0, 'nothing was written');
  });

  test('saves a valid count and can complete the series', async () => {
    const user = await createUser();
    const anime = await createAnime({ episodes: 12 });
    const first = await read(await patch(user, anime.id, { episodesWatched: 3, status: 'watching' }));
    assert.equal(first.status, 200);
    const done = await read(await patch(user, anime.id, { episodesWatched: 12, status: 'completed' }));
    assert.equal(done.status, 200);
    const row = await prisma.userAnime.findUnique({ where: { userId_animeId: { userId: user.id, animeId: anime.id } } });
    assert.equal(row?.episodesWatched, 12);
    assert.equal(row?.status, 'COMPLETED');
  });

  test('without a declared total, any sane whole number is accepted', async () => {
    const user = await createUser();
    const anime = await createAnime({ episodes: null });
    assert.equal((await patch(user, anime.id, { episodesWatched: 140 })).status, 200);
  });
});
