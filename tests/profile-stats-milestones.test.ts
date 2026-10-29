import './helpers/setupTestDb';

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import { PATCH as libraryPATCH } from '../src/app/api/library/[animeId]/route';
import { GET as statsGET } from '../src/app/api/users/[username]/stats/route';
import { COMPLETION_MILESTONE_NOTIFICATION } from '../src/lib/library/completionMilestones';

after(async () => {
  await prisma.$disconnect();
});

const complete = async (as: any, animeId: string) =>
  read(await libraryPATCH(request('PATCH', `/api/library/${animeId}`, { as, body: { status: 'completed' } }), { params: { animeId } }));

test('completing the 10th anime earns the milestone right away, exactly once', async () => {
  const u = await createUser();
  const shows = await Promise.all(Array.from({ length: 11 }, () => createAnime({ status: 'Finished Airing', episodes: 12 })));

  for (const s of shows.slice(0, 9)) assert.equal((await complete(u, s.id)).status, 200);
  assert.equal(await prisma.notification.count({ where: { userId: u.id, type: COMPLETION_MILESTONE_NOTIFICATION } }), 0, 'not at 9');

  await complete(u, shows[9].id); // 10th
  const n = await prisma.notification.findMany({ where: { userId: u.id, type: COMPLETION_MILESTONE_NOTIFICATION } });
  assert.equal(n.length, 1);
  assert.match(n[0].title, /10 anime completed/);

  await complete(u, shows[10].id); // 11th — no repeat
  assert.equal(await prisma.notification.count({ where: { userId: u.id, type: COMPLETION_MILESTONE_NOTIFICATION } }), 1);
});

test('profile stats: tracking, completed, rated (by retention), reviews, milestone progress — live', async () => {
  const u = await createUser();
  const [a, b, c] = await Promise.all([1, 2, 3].map(() => createAnime({ status: 'Finished Airing', episodes: 12 })));
  await prisma.userAnime.createMany({
    data: [
      { userId: u.id, animeId: a.id, status: 'COMPLETED' },
      { userId: u.id, animeId: b.id, status: 'WATCHING' },
      { userId: u.id, animeId: c.id, status: 'DROPPED' },
    ],
  });
  await prisma.episodeRating.createMany({
    data: [
      { userId: u.id, animeId: a.id, episodeNumber: 1, retention: 80 },
      { userId: u.id, animeId: b.id, episodeNumber: 1, retention: 60 },
    ],
  });
  await prisma.review.createMany({
    data: [
      { userId: u.id, animeId: a.id, title: '', body: 'Loved it from start to finish.', status: 'PUBLISHED' },
      { userId: u.id, animeId: b.id, title: '', body: 'A draft that is not published.', status: 'DRAFT' },
    ],
  });
  const res = await read(await statsGET(request('GET', `/api/users/${u.username}/stats`), { params: { username: u.username } }));
  assert.equal(res.status, 200);
  assert.equal(res.body.tracking, 3);
  assert.equal(res.body.completed, 1);
  assert.equal(res.body.dropped, 1);
  assert.equal(res.body.rated, 2);
  assert.equal(res.body.meanRetention, 70);
  assert.equal(res.body.reviews, 1, 'drafts do not count');
  assert.deepEqual(res.body.milestones, { earned: [], next: 10, toNext: 9 });
});
