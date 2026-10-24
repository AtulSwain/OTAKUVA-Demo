import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createCommunity, createUser } from './helpers/fixtures';
import { notifyFollowersOfReview } from '../src/lib/social/followService';

import { GET as followGET, POST as followPOST, DELETE as followDELETE } from '../src/app/api/users/[username]/follow/route';
import { GET as followersGET } from '../src/app/api/users/[username]/followers/route';
import { GET as followingGET } from '../src/app/api/users/[username]/following/route';
import { POST as articlePOST } from '../src/app/api/articles/route';
import { POST as listsPOST } from '../src/app/api/lists/route';
import { PATCH as listPATCH } from '../src/app/api/lists/[id]/route';
import { POST as itemsPOST } from '../src/app/api/lists/[id]/items/route';
import { POST as discussionPOST } from '../src/app/api/discussions/route';

after(async () => {
  await prisma.$disconnect();
});

const p = (u: { username: string }) => ({ params: { username: u.username } });
const follow = (as: any, target: any) => followPOST(request('POST', `/api/users/${target.username}/follow`, { as }), p(target)).then(read);
const unfollow = (as: any, target: any) => followDELETE(request('DELETE', `/api/users/${target.username}/follow`, { as }), p(target)).then(read);
const state = (as: any, target: any) => followGET(request('GET', `/api/users/${target.username}/follow`, { as }), p(target)).then(read);
const inbox = (user: { id: string }, type: string) => prisma.notification.findMany({ where: { userId: user.id, type } });

const BODY =
  'A proper write-up about this season, long enough to pass the article length check. It covers the studio, the staff and why it matters, and links to sources.';

describe('following members', () => {
  test('follow, counts, "follows you", and unfollow', async () => {
    const a = await createUser();
    const b = await createUser();

    const first = await follow(a, b);
    assert.equal(first.status, 201);
    assert.equal(first.body.followerCount, 1);
    assert.equal((await follow(a, b)).status, 200, 'following twice is a no-op');

    const seenByA = await state(a, b);
    assert.deepEqual(
      { ...seenByA.body },
      { followerCount: 1, followingCount: 0, isFollowing: true, followsYou: false, isCreator: false, channelName: null, channelUrl: null }
    );
    const seenByB = await state(b, a);
    assert.equal(seenByB.body.followsYou, true, 'b sees that a follows them');
    assert.equal(seenByB.body.isFollowing, false);

    assert.equal((await inbox(b, 'NEW_FOLLOWER')).length, 1);

    const off = await unfollow(a, b);
    assert.equal(off.body.followerCount, 0);
    // Re-following within a day doesn't ping them again.
    await follow(a, b);
    assert.equal((await inbox(b, 'NEW_FOLLOWER')).length, 1);
  });

  test('cannot follow yourself; signed out cannot follow; unknown user is 404', async () => {
    const a = await createUser();
    assert.equal((await follow(a, a)).status, 400);
    assert.equal((await follow(undefined, a)).status, 401);
    assert.equal((await follow(a, { username: 'nobody_here_at_all' })).status, 404);
  });

  test('followers / following lists show who and whether the viewer follows them', async () => {
    const star = await createUser();
    const fan1 = await createUser();
    const fan2 = await createUser();
    await follow(fan1, star);
    await follow(fan2, star);
    await follow(fan1, fan2);

    const list = await read(await followersGET(request('GET', `/api/users/${star.username}/followers`, { as: fan1 }), p(star)));
    assert.equal(list.status, 200);
    const byName = Object.fromEntries(list.body.items.map((i: any) => [i.username, i]));
    assert.equal(Object.keys(byName).length, 2);
    assert.equal(byName[fan2.username].viewerFollows, true, 'fan1 follows fan2');
    assert.equal(byName[fan1.username].isViewer, true);

    const following = await read(await followingGET(request('GET', `/api/users/${fan1.username}/following`), p(fan1)));
    assert.deepEqual(following.body.items.map((i: any) => i.username).sort(), [fan2.username, star.username].sort());
    assert.equal(following.body.items[0].viewerFollows, null, 'signed out: unknown');
  });

  test('followers are notified of a new article, once', async () => {
    const author = await createUser();
    const fan = await createUser();
    const stranger = await createUser();
    await follow(fan, author);

    const res = await read(await articlePOST(request('POST', '/api/articles', { as: author, body: { title: 'Why this season is special', body: BODY } })));
    assert.equal(res.status, 201, JSON.stringify(res.body));

    const got = await inbox(fan, 'FOLLOWING_ARTICLE');
    assert.equal(got.length, 1);
    assert.match(got[0].title, new RegExp(`@${author.username} posted an article`));
    assert.equal(got[0].linkUrl, `/articles/${res.body.article.slug}`);
    assert.equal((await inbox(stranger, 'FOLLOWING_ARTICLE')).length, 0, 'non-followers hear nothing');
    assert.equal((await inbox(author, 'FOLLOWING_ARTICLE')).length, 0);
  });

  test('review fan-out happens once per review, never for hidden ones', async () => {
    const reviewer = await createUser();
    const fan = await createUser();
    await follow(fan, reviewer);
    const anime = await createAnime();
    const review = await prisma.review.create({ data: { userId: reviewer.id, animeId: anime.id, title: '', body: 'Great show.' } });

    await notifyFollowersOfReview(reviewer.id, review.id);
    await notifyFollowersOfReview(reviewer.id, review.id); // an edit re-runs this
    const got = await inbox(fan, 'FOLLOWING_REVIEW');
    assert.equal(got.length, 1);
    assert.match(got[0].body!, new RegExp(`has reviewed ${anime.canonicalTitle}`));

    const anime2 = await createAnime();
    const hidden = await prisma.review.create({ data: { userId: reviewer.id, animeId: anime2.id, title: '', body: 'x', status: 'HIDDEN' } });
    await notifyFollowersOfReview(reviewer.id, hidden.id);
    assert.equal((await inbox(fan, 'FOLLOWING_REVIEW')).length, 1);
  });

  test('collections notify only when public and not empty', async () => {
    const curator = await createUser();
    const fan = await createUser();
    await follow(fan, curator);
    const anime = await createAnime();

    // Private with anime: nothing.
    const priv = await read(await listsPOST(request('POST', '/api/lists', { as: curator, body: { name: 'Secret picks', animeId: anime.id } })));
    assert.equal((await inbox(fan, 'FOLLOWING_COLLECTION')).length, 0);

    // Made public: announced.
    const id = priv.body.list.id;
    await listPATCH(request('PATCH', `/api/lists/${id}`, { as: curator, body: { visibility: 'PUBLIC' } }), { params: { id } });
    assert.equal((await inbox(fan, 'FOLLOWING_COLLECTION')).length, 1);

    // Public but empty: only once its first anime is added.
    const empty = await read(await listsPOST(request('POST', '/api/lists', { as: curator, body: { name: 'Coming soon', visibility: 'PUBLIC' } })));
    assert.equal((await inbox(fan, 'FOLLOWING_COLLECTION')).length, 1);
    const eid = empty.body.list.id;
    await itemsPOST(request('POST', `/api/lists/${eid}/items`, { as: curator, body: { animeId: anime.id } }), { params: { id: eid } });
    const got = await inbox(fan, 'FOLLOWING_COLLECTION');
    assert.equal(got.length, 2);
    assert.ok(got.every((n) => n.linkUrl?.startsWith('/l/')));
  });

  test('community activity: public threads only, at most once a day', async () => {
    const poster = await createUser();
    const fan = await createUser();
    await follow(fan, poster);

    const post = (body: Record<string, unknown>) => discussionPOST(request('POST', '/api/discussions', { as: poster, body })).then(read);

    const secret = await createCommunity(poster, 'PRIVATE');
    const hidden = await post({ title: 'Members only thread', body: 'Only for members.', communityId: secret.id });
    assert.equal(hidden.status, 201, JSON.stringify(hidden.body));
    assert.equal((await inbox(fan, 'FOLLOWING_COMMUNITY')).length, 0, 'private community: no notification');

    const first = await post({ title: 'Season finale thoughts', body: 'What a way to end it.' });
    assert.equal(first.status, 201);
    await post({ title: 'Another one', body: 'Second thread today.' });
    const got = await inbox(fan, 'FOLLOWING_COMMUNITY');
    assert.equal(got.length, 1, 'throttled to one a day');
    assert.equal(got[0].linkUrl, `/discussions/${first.body.discussion.id}`);
    assert.match(got[0].title, /is active in the community/);
  });
});
