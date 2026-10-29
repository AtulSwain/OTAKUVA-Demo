import './helpers/setupTestDb';
import './helpers/cssStub';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import Seal from '../src/components/badges/Seal';

import { GET as ratingsGET } from '../src/app/api/users/[username]/ratings/route';
import { GET as collectionsGET } from '../src/app/api/collections/public/route';
import { POST as listsPOST } from '../src/app/api/lists/route';

(globalThis as any).React = React;

after(async () => {
  await prisma.$disconnect();
});

describe('public profile sections', () => {
  test("rated tab: anime the member rated episodes of, with their retention; star ratings don't show", async () => {
    const member = await createUser();
    const [a, b, c] = [await createAnime(), await createAnime(), await createAnime()];
    await prisma.episodeRating.createMany({
      data: [
        { userId: member.id, animeId: a.id, episodeNumber: 1, retention: 80 },
        { userId: member.id, animeId: a.id, episodeNumber: 2, retention: 91 },
        { userId: member.id, animeId: b.id, episodeNumber: 1, retention: 40 },
      ],
    });
    // A 1–10 star rating alone (stars are off) is not listed.
    await prisma.animeRating.create({ data: { userId: member.id, animeId: c.id, rating: 9 } });
    await prisma.review.create({ data: { userId: member.id, animeId: b.id, title: '', body: 'Solid but slow.' } });

    const res = await read(await ratingsGET(request('GET', `/api/users/${member.username}/ratings`), { params: { username: member.username } }));
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 2);
    const bySlug = Object.fromEntries(res.body.items.map((i: any) => [i.anime.slug, i]));
    assert.equal(bySlug[a.slug].retention, 86, '(80 + 91) / 2 rounded');
    assert.equal(bySlug[a.slug].episodes, 2);
    assert.equal(bySlug[a.slug].reviewed, false);
    assert.equal(bySlug[b.slug].reviewed, true);
    assert.equal(bySlug[c.slug], undefined);

    const missing = await ratingsGET(request('GET', '/api/users/nobody_at_all/ratings'), { params: { username: 'nobody_at_all' } });
    assert.equal(missing.status, 404);
  });

  test("collections ?user= lists only that member's PUBLIC, non-empty collections", async () => {
    const member = await createUser();
    const other = await createUser();
    const anime = await createAnime();
    const make = (as: any, body: Record<string, unknown>) => listsPOST(request('POST', '/api/lists', { as, body })).then(read);
    await make(member, { name: 'Shown', visibility: 'PUBLIC', animeId: anime.id });
    await make(member, { name: 'Hidden', visibility: 'PRIVATE', animeId: anime.id });
    await make(member, { name: 'By link', visibility: 'LINK', animeId: anime.id });
    await make(member, { name: 'Empty', visibility: 'PUBLIC' });
    await make(other, { name: 'Someone else', visibility: 'PUBLIC', animeId: anime.id });

    const req = request('GET', `/api/collections/public?user=${member.username}`) as any;
    const res = await read(await collectionsGET(req));
    assert.deepEqual(res.body.items.map((c: any) => c.name), ['Shown']);
  });
});

describe('round hanko stamps', () => {
  test('an earned seal is a circle; blank shows the un-inked slot with the same kanji', () => {
    const stamped = renderToStaticMarkup(React.createElement(Seal, { tier: 'kohai', size: 64 }));
    assert.match(stamped, /<circle/);
    assert.ok(!/<rect[^>]*class="[^"]*plate/.test(stamped), 'no square plate');
    const blank = renderToStaticMarkup(React.createElement(Seal, { tier: 'kohai', size: 64, blank: true }));
    assert.match(blank, /not yet earned/);
    assert.match(blank, /stroke-dasharray|empty/);
  });
});
