import './helpers/setupTestDb';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import { POST as ratePOST } from '../src/app/api/anime/[id]/rating/route';
import { POST as epPOST } from '../src/app/api/anime/[id]/episode-ratings/route';

after(async () => {
  await prisma.$disconnect();
});

test('1–10 star ratings are not saved by default; retention still is', async () => {
  delete process.env.STAR_RATINGS_ENABLED;
  const show = await createAnime({ status: 'Finished Airing', episodes: 3 });
  const u = await createUser();
  const p = { params: { id: show.id } };

  const star = await read(await ratePOST(request('POST', `/api/anime/${show.id}/rating`, { as: u, body: { score: 8 } }), p));
  assert.equal(star.status, 410);
  assert.equal(star.body.code, 'STAR_RATINGS_OFF');
  const legacyEp = await read(await epPOST(request('POST', `/api/anime/${show.id}/episode-ratings`, { as: u, body: { episodeNumber: 1, score: 8 } }), p));
  assert.equal(legacyEp.status, 410);
  assert.equal(await prisma.animeRating.count({ where: { userId: u.id } }), 0);

  await prisma.userEpisodeWatch.create({ data: { userId: u.id, animeId: show.id, episodeNumber: 1 } });
  const retention = await read(await epPOST(request('POST', `/api/anime/${show.id}/episode-ratings`, { as: u, body: { episodeNumber: 1, retention: 77 } }), p));
  assert.equal(retention.status, 200);
});
