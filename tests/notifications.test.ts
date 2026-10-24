import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { upsertEpisodeFromProvider, notifyLibraryUsersOfNewEpisodes } from '../src/lib/catalog/episodeIngest';
import { createCommunityPost } from '../src/lib/engine/community/communityEngine';
import { request, read } from './helpers/http';
import { createAnime, createCommunity, createUser, addMember } from './helpers/fixtures';

import { POST as followPOST, DELETE as followDELETE } from '../src/app/api/users/[username]/follow/route';

after(async () => {
  await prisma.$disconnect();
});

function fakeEpisode(number: number, airedAt: string | null, overrides: Partial<{ filler: boolean; recap: boolean }> = {}) {
  return { number, title: `Episode ${number}`, airedAt, filler: false, recap: false, ...overrides };
}

describe('episode-aired library notifications', () => {
  test('upsertEpisodeFromProvider flags isNewlyAired only on the write that crosses into the past, not on re-syncs', async () => {
    const anime = await createAnime();
    const past = new Date(Date.now() - 60_000).toISOString();

    const first = await upsertEpisodeFromProvider(anime.id, fakeEpisode(1, past));
    assert.equal(first.success, true);
    assert.equal(first.isNewlyAired, true, 'a brand-new episode with a past airedAt is newly aired');

    const resync = await upsertEpisodeFromProvider(anime.id, fakeEpisode(1, past));
    assert.equal(resync.isNewlyAired, false, 're-syncing the same already-aired episode does not flag it again');
  });

  test('a future airedAt is not newly aired until it actually transitions into the past', async () => {
    const anime = await createAnime();
    const future = new Date(Date.now() + 60_000).toISOString();

    const announced = await upsertEpisodeFromProvider(anime.id, fakeEpisode(1, future));
    assert.equal(announced.isNewlyAired, false, 'an episode airing in the future is not "newly aired" yet');

    const past = new Date(Date.now() - 60_000).toISOString();
    const aired = await upsertEpisodeFromProvider(anime.id, fakeEpisode(1, past));
    assert.equal(aired.isNewlyAired, true, 'once its airedAt is updated into the past, it becomes newly aired');
  });

  test('notifyLibraryUsersOfNewEpisodes only notifies WATCHING/PLAN_TO_WATCH trackers, never COMPLETED/DROPPED or non-trackers', async () => {
    const anime = await createAnime({ canonicalTitle: 'Notify Test Show' });
    const watching = await createUser();
    const planned = await createUser();
    const completed = await createUser();
    const dropped = await createUser();
    const untracked = await createUser();

    await prisma.userAnime.createMany({
      data: [
        { userId: watching.id, animeId: anime.id, status: 'WATCHING' },
        { userId: planned.id, animeId: anime.id, status: 'PLAN_TO_WATCH' },
        { userId: completed.id, animeId: anime.id, status: 'COMPLETED' },
        { userId: dropped.id, animeId: anime.id, status: 'DROPPED' },
      ],
    });

    await notifyLibraryUsersOfNewEpisodes(anime.id, 1);

    const notified = await prisma.notification.findMany({ where: { type: 'NEW_EPISODE' } });
    const notifiedUserIds = notified.map((n) => n.userId).sort();
    assert.deepEqual(notifiedUserIds, [planned.id, watching.id].sort());
    assert.ok(!notifiedUserIds.includes(completed.id));
    assert.ok(!notifiedUserIds.includes(dropped.id));
    assert.ok(!notifiedUserIds.includes(untracked.id));
    assert.match(notified[0].body || '', /Notify Test Show/);
    assert.equal(notified[0].linkUrl, `/anime/${anime.slug}`);
  });

  test('a zero newly-aired count is a no-op — no notifications created', async () => {
    const anime = await createAnime();
    const user = await createUser();
    await prisma.userAnime.create({ data: { userId: user.id, animeId: anime.id, status: 'WATCHING' } });

    await notifyLibraryUsersOfNewEpisodes(anime.id, 0);

    assert.equal(await prisma.notification.count({ where: { userId: user.id, type: 'NEW_EPISODE' } }), 0);
  });
});

describe('community new-discussion notifications', () => {
  test('active members are notified of a new post; the poster and non-members are not', async () => {
    const owner = await createUser();
    const member = await createUser();
    const outsider = await createUser();
    const community = await createCommunity(owner, 'PUBLIC');
    await addMember(community.id, member);

    await createCommunityPost({
      authorId: owner.id,
      communityId: community.id,
      title: 'Hello community',
      body: 'First post here.',
    });

    const notifications = await prisma.notification.findMany({ where: { type: 'COMMUNITY_NEW_DISCUSSION' } });
    const notifiedUserIds = notifications.map((n) => n.userId);
    assert.deepEqual(notifiedUserIds, [member.id]);
    assert.ok(!notifiedUserIds.includes(owner.id), 'the poster is never notified about their own post');
    assert.ok(!notifiedUserIds.includes(outsider.id));
    assert.match(notifications[0].body || '', /Hello community/);
  });
});

describe('POST/DELETE /api/users/:username/follow', () => {
  test('requires authentication', async () => {
    const target = await createUser();
    const res = await followPOST(request('POST', `/api/users/${target.username}/follow`), { params: { username: target.username } });
    assert.equal(res.status, 401);
  });

  test('cannot follow yourself', async () => {
    const user = await createUser();
    const res = await followPOST(request('POST', `/api/users/${user.username}/follow`, { as: user }), { params: { username: user.username } });
    assert.equal(res.status, 400);
  });

  test('404s for an unknown username', async () => {
    const user = await createUser();
    const res = await followPOST(request('POST', '/api/users/does-not-exist/follow', { as: user }), { params: { username: 'does-not-exist' } });
    assert.equal(res.status, 404);
  });

  test('creates a Follow row and notifies the target; is idempotent; unfollow removes it', async () => {
    const follower = await createUser();
    const target = await createUser();

    const first = await read(
      await followPOST(request('POST', `/api/users/${target.username}/follow`, { as: follower }), { params: { username: target.username } })
    );
    assert.equal(first.status, 201);
    assert.equal(first.body.following, true);

    assert.ok(
      await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: follower.id, followingId: target.id } } })
    );
    const notif = await prisma.notification.findFirst({ where: { userId: target.id, type: 'NEW_FOLLOWER' } });
    assert.ok(notif);
    assert.match(notif!.body || '', new RegExp(follower.username));
    assert.equal(notif!.linkUrl, `/profile/${follower.username}`);

    // Idempotent — following again doesn't duplicate the row or re-notify.
    const second = await read(
      await followPOST(request('POST', `/api/users/${target.username}/follow`, { as: follower }), { params: { username: target.username } })
    );
    assert.equal(second.status, 200);
    assert.equal(await prisma.follow.count({ where: { followerId: follower.id, followingId: target.id } }), 1);
    assert.equal(await prisma.notification.count({ where: { userId: target.id, type: 'NEW_FOLLOWER' } }), 1);

    // Unfollow removes the row.
    const del = await followDELETE(request('DELETE', `/api/users/${target.username}/follow`, { as: follower }), {
      params: { username: target.username },
    });
    assert.equal(del.status, 200);
    assert.equal(
      await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: follower.id, followingId: target.id } } }),
      null
    );

    // Unfollowing again (not currently following) is a harmless no-op.
    const delAgain = await followDELETE(request('DELETE', `/api/users/${target.username}/follow`, { as: follower }), {
      params: { username: target.username },
    });
    assert.equal(delAgain.status, 200);
  });
});
