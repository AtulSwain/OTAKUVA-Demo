import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import { GET as reviewsGET } from '../src/app/api/reviews/route';
import { POST as pinPOST, DELETE as pinDELETE } from '../src/app/api/reviews/[id]/pin/route';
import { retentionTone } from '../src/lib/rating/retentionTone';

after(async () => {
  await prisma.$disconnect();
});

const p = (id: string) => ({ params: { id } });
async function review(userId: string, animeId: string) {
  return prisma.review.create({ data: { userId, animeId, title: '', body: 'A long enough review body for the test.', status: 'PUBLISHED' } });
}

describe('pinned reviews', () => {
  test('moderators pin (max 3 per anime, logged); members cannot; the list returns pinned on top', async () => {
    const mod = await createUser('MODERATOR');
    const member = await createUser();
    const anime = await createAnime({ status: 'Finished Airing', episodes: 12 });
    const authors = await Promise.all([1, 2, 3, 4].map(() => createUser()));
    const reviews = await Promise.all(authors.map((a) => review(a.id, anime.id)));

    assert.equal((await pinPOST(request('POST', `/api/reviews/${reviews[0].id}/pin`, { as: member }), p(reviews[0].id))).status, 403);
    for (const r of reviews.slice(0, 3)) {
      assert.equal((await pinPOST(request('POST', `/api/reviews/${r.id}/pin`, { as: mod }), p(r.id))).status, 200);
    }
    assert.equal((await pinPOST(request('POST', `/api/reviews/${reviews[3].id}/pin`, { as: mod }), p(reviews[3].id))).status, 409, 'max 3');
    assert.equal(await prisma.moderationAction.count({ where: { moderatorId: mod.id, action: 'PIN' } }), 3);

    const asMod = (await read(await reviewsGET(request('GET', `/api/reviews?animeId=${anime.id}`, { as: mod })))).body;
    assert.deepEqual(asMod.pinned.map((r: any) => r.id).sort(), reviews.slice(0, 3).map((r) => r.id).sort());
    assert.equal(asMod.canPin, true);
    const asMember = (await read(await reviewsGET(request('GET', `/api/reviews?animeId=${anime.id}`, { as: member })))).body;
    assert.equal(asMember.canPin, false);

    assert.equal((await pinDELETE(request('DELETE', `/api/reviews/${reviews[0].id}/pin`, { as: mod }), p(reviews[0].id))).status, 200);
    const after1 = await prisma.review.findUniqueOrThrow({ where: { id: reviews[0].id } });
    assert.equal(after1.pinnedAt, null);
  });
});

describe('retention colours follow the badge bands (2026-10-25)', () => {
  test('raw value → band', () => {
    assert.equal(retentionTone(100), 'HOOKED');
    assert.equal(retentionTone(90), 'HOOKED');
    assert.equal(retentionTone(89.6), 'PEAKING');
    assert.equal(retentionTone(70), 'PEAKING');
    assert.equal(retentionTone(69.9), 'SOLID');
    assert.equal(retentionTone(40), 'SOLID');
    assert.equal(retentionTone(39), 'SLEEPER');
    assert.equal(retentionTone(20), 'SLEEPER');
    assert.equal(retentionTone(19.9), 'DROPPED');
    assert.equal(retentionTone(1), 'DROPPED');
  });
});
