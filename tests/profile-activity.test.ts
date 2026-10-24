import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import { GET as activityGET } from '../src/app/api/users/[username]/activity/route';

after(async () => {
  await prisma.$disconnect();
});

describe('profile activity', () => {
  test('owner sees everything they did; visitors only public actions; filters + paging', async () => {
    const me = await createUser();
    const visitor = await createUser();
    const show = await createAnime({ status: 'Finished Airing', episodes: 12 });
    const upcoming = await createAnime({ status: 'Not yet aired' });

    await prisma.animeRating.create({ data: { userId: me.id, animeId: show.id, rating: 9 } });
    await prisma.review.create({ data: { userId: me.id, animeId: show.id, title: '', body: 'A long enough review body for the test.', status: 'PUBLISHED' } });
    await prisma.episodeRating.create({ data: { userId: me.id, animeId: show.id, episodeNumber: 3, retention: 80 } });
    await prisma.animeHype.create({ data: { userId: me.id, animeId: upcoming.id, level: 'HYPED' } });
    await prisma.activity.create({ data: { userId: me.id, type: 'STATUS_CHANGED', animeId: show.id, metadata: JSON.stringify({ status: 'COMPLETED' }) } });

    const url = `/api/users/${me.username}/activity`;
    const p = { params: { username: me.username } };
    const mine = (await read(await activityGET(request('GET', url, { as: me }), p))).body;
    const kinds = new Set(mine.items.map((i: any) => i.kind));
    for (const k of ['RATED', 'REVIEWED', 'RETENTION', 'HYPE', 'LIBRARY']) assert.ok(kinds.has(k), `owner sees ${k}`);
    assert.equal(mine.isOwner, true);
    assert.equal(mine.totals.RATED, 1);
    assert.equal(mine.items.find((i: any) => i.kind === 'RATED').value, 9);
    assert.equal(mine.items.find((i: any) => i.kind === 'LIBRARY').value, 'Completed');
    assert.equal(mine.items.find((i: any) => i.kind === 'HYPE').private, true);

    const theirs = (await read(await activityGET(request('GET', url, { as: visitor }), p))).body;
    const vk = new Set(theirs.items.map((i: any) => i.kind));
    assert.ok(vk.has('RATED') && vk.has('REVIEWED'), 'public actions show');
    for (const k of ['RETENTION', 'HYPE', 'LIBRARY']) assert.ok(!vk.has(k), `${k} stays private`);
    assert.equal(theirs.totals.HYPE, undefined);

    // Filter + paging.
    const onlyRatings = (await read(await activityGET(request('GET', `${url}?kinds=RATED&stats=0`, { as: me }), p))).body;
    assert.ok(onlyRatings.items.every((i: any) => i.kind === 'RATED'));
    assert.equal(onlyRatings.days, undefined);
    const page1 = (await read(await activityGET(request('GET', `${url}?limit=2&stats=0`, { as: me }), p))).body;
    assert.equal(page1.items.length, 2);
    assert.ok(page1.nextCursor);
    const page2 = (await read(await activityGET(request('GET', `${url}?limit=2&stats=0&before=${encodeURIComponent(page1.nextCursor)}`, { as: me }), p))).body;
    assert.ok(page2.items.every((i: any) => i.at < page1.nextCursor), 'next page is strictly older');
  });
});
