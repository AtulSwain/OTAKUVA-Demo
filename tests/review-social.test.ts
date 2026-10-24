import './helpers/setupTestDb';

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read, type TestUser } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';

import { GET as reviewsGET, POST as reviewsPOST } from '../src/app/api/reviews/route';
import { PATCH as reviewPATCH } from '../src/app/api/reviews/[id]/route';
import { GET as repliesGET, POST as repliesPOST } from '../src/app/api/reviews/[id]/replies/route';
import { DELETE as replyDELETE } from '../src/app/api/reviews/[id]/replies/[replyId]/route';

after(async () => {
  await prisma.$disconnect();
});

const BODY = 'A long enough review body to pass the twenty character minimum.';

const writeReview = async (as: TestUser, animeId: string, extra: Record<string, unknown> = {}) =>
  read(await reviewsPOST(request('POST', '/api/reviews', { as, body: { animeId, body: BODY, ...extra } })));

const listReviews = async (animeId: string, as?: TestUser) =>
  read(await reviewsGET(request('GET', `/api/reviews?animeId=${animeId}`, { as })));

const reply = async (as: TestUser, reviewId: string, body: unknown) =>
  read(await repliesPOST(request('POST', `/api/reviews/${reviewId}/replies`, { as, body: { body } }), { params: { id: reviewId } }));

describe('review tags', () => {
  let a: any, b: any, c: any, anime: any;

  before(async () => {
    [a, b, c] = await Promise.all([createUser(), createUser(), createUser()]);
    anime = await createAnime();
  });

  test('a review needs no headline, and only known tags are kept (deduped, max 5)', async () => {
    const res = await writeReview(a, anime.id, {
      tags: ['comfy', 'comfy', 'not-a-real-tag', 'great-ost', 'slow-burn', 'funny', 'dark', 'hype'],
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.review.tags, ['comfy', 'great-ost', 'slow-burn', 'funny', 'dark']);
    const stored = await prisma.review.findUnique({ where: { id: res.body.review.id }, select: { title: true } });
    assert.equal(stored?.title, '');
  });

  test('community tags count visible reviews and drop hidden ones', async () => {
    const rb = await writeReview(b, anime.id, { tags: ['comfy', 'great-ost'] });
    await writeReview(c, anime.id, { tags: ['comfy'] });

    let list = await listReviews(anime.id);
    const counts = Object.fromEntries(list.body.communityTags.map((t: any) => [t.tag, t.count]));
    assert.equal(counts.comfy, 3);
    assert.equal(counts['great-ost'], 2);
    assert.equal(list.body.communityTags[0].tag, 'comfy', 'most-picked first');
    assert.equal(list.body.communityTags[0].label, 'Comfy');
    assert.deepEqual(list.body.reviews.find((r: any) => r.id === rb.body.review.id).tags, ['comfy', 'great-ost']);

    await prisma.review.update({ where: { id: rb.body.review.id }, data: { status: 'HIDDEN' } });
    list = await listReviews(anime.id);
    const after = Object.fromEntries(list.body.communityTags.map((t: any) => [t.tag, t.count]));
    assert.equal(after.comfy, 2);
    assert.equal(after['great-ost'], 1);
  });

  test('editing replaces tags; omitting the field leaves them alone; others cannot change them', async () => {
    const anime2 = await createAnime();
    const r = (await writeReview(a, anime2.id, { tags: ['dark'] })).body.review;

    const patch = async (as: TestUser, body: Record<string, unknown>) =>
      read(await reviewPATCH(request('PATCH', `/api/reviews/${r.id}`, { as, body }), { params: { id: r.id } }));

    assert.equal((await patch(a, { tags: ['funny', 'wholesome'] })).status, 200);
    let tags = (await prisma.reviewTag.findMany({ where: { reviewId: r.id } })).map((t) => t.tag).sort();
    assert.deepEqual(tags, ['funny', 'wholesome']);

    assert.equal((await patch(a, { body: `${BODY} Edited.` })).status, 200);
    tags = (await prisma.reviewTag.findMany({ where: { reviewId: r.id } })).map((t) => t.tag).sort();
    assert.deepEqual(tags, ['funny', 'wholesome'], 'untouched when tags omitted');

    const other = await patch(b, { tags: ['dark'] });
    assert.equal(other.status, 403);
    tags = (await prisma.reviewTag.findMany({ where: { reviewId: r.id } })).map((t) => t.tag).sort();
    assert.deepEqual(tags, ['funny', 'wholesome']);
  });
});

describe('review replies', () => {
  let author: any, replier: any, stranger: any, mod: any, anime: any, review: any;

  before(async () => {
    [author, replier, stranger] = await Promise.all([createUser(), createUser(), createUser()]);
    mod = await createUser('MODERATOR');
    anime = await createAnime();
    review = (await writeReview(author, anime.id)).body.review;
  });

  test('replying notifies the review author and shows inline with the review', async () => {
    const res = await reply(replier, review.id, '  Totally agree about the ending.  ');
    assert.equal(res.status, 201);
    assert.equal(res.body.reply.body, 'Totally agree about the ending.');
    assert.equal(res.body.reply.canDelete, true);

    const notes = await prisma.notification.findMany({ where: { userId: author.id, type: 'REPLY_REVIEW' } });
    assert.equal(notes.length, 1);
    assert.equal(notes[0].title, `${replier.username} replied to your review`);

    const list = await listReviews(anime.id, stranger);
    const r = list.body.reviews.find((x: any) => x.id === review.id);
    assert.equal(r.replyCount, 1);
    assert.equal(r.replies[0].user.username, replier.username);
    assert.equal(r.replies[0].canDelete, false, 'strangers cannot delete');
  });

  test('replying to your own review does not notify yourself', async () => {
    const before = await prisma.notification.count({ where: { userId: author.id } });
    assert.equal((await reply(author, review.id, 'Thanks!')).status, 201);
    assert.equal(await prisma.notification.count({ where: { userId: author.id } }), before);
  });

  test('validation: empty, too long, unknown review, signed out', async () => {
    assert.equal((await reply(replier, review.id, '   ')).status, 400);
    assert.equal((await reply(replier, review.id, 'x'.repeat(1001))).status, 400);
    assert.equal((await reply(replier, 'no-such-review', 'hello')).status, 404);
    const anon = await read(
      await repliesPOST(request('POST', `/api/reviews/${review.id}/replies`, { body: { body: 'hi' } }), { params: { id: review.id } })
    );
    assert.equal(anon.status, 401);
  });

  test('only the author or a moderator can delete; deleted replies disappear', async () => {
    const r1 = (await reply(replier, review.id, 'first')).body.reply;
    const r2 = (await reply(replier, review.id, 'second')).body.reply;
    const del = async (as: TestUser, id: string) =>
      read(await replyDELETE(request('DELETE', `/api/reviews/${review.id}/replies/${id}`, { as }), { params: { id: review.id, replyId: id } }));

    assert.equal((await del(stranger, r1.id)).status, 403);
    assert.equal((await del(replier, r1.id)).status, 200);
    assert.equal((await del(mod, r2.id)).status, 200);
    assert.equal((await del(replier, r1.id)).status, 404, 'already deleted');

    const all = await read(await repliesGET(request('GET', `/api/reviews/${review.id}/replies`), { params: { id: review.id } }));
    const ids = all.body.replies.map((x: any) => x.id);
    assert.ok(!ids.includes(r1.id) && !ids.includes(r2.id));
  });
});
