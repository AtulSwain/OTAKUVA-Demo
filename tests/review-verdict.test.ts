import './helpers/setupTestDb';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import { GET as reviewsGET } from '../src/app/api/reviews/route';

after(async () => {
  await prisma.$disconnect();
});

test("each review carries its author's own retention for the anime (the verdict pill)", async () => {
  const show = await createAnime({ status: 'Finished Airing', episodes: 3 });
  const [a, b] = await Promise.all([createUser(), createUser()]);
  await prisma.review.createMany({
    data: [
      { userId: a.id, animeId: show.id, title: '', body: 'A long enough review body for testing.', status: 'PUBLISHED' },
      { userId: b.id, animeId: show.id, title: '', body: 'Another long enough review body here.', status: 'PUBLISHED' },
    ],
  });
  await prisma.episodeRating.createMany({
    data: [
      { userId: a.id, animeId: show.id, episodeNumber: 1, retention: 90 },
      { userId: a.id, animeId: show.id, episodeNumber: 2, retention: 95 },
    ],
  });
  const res = await read(await reviewsGET(request('GET', `/api/reviews?animeId=${show.id}`)));
  assert.equal(res.status, 200);
  const byUser = new Map(res.body.reviews.map((r: any) => [r.user.id, r]));
  assert.equal((byUser.get(a.id) as any).retention, 93, '(90 + 95) / 2 rounded');
  assert.equal((byUser.get(b.id) as any).retention, null, 'no episode ratings → no verdict');
});
