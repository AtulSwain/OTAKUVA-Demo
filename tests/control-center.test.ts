import './helpers/setupTestDb';

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { read, request } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';

import { GET as overviewGET } from '../src/app/api/control/overview/route';
import { GET as usersGET } from '../src/app/api/control/users/route';
import { GET as animeListGET } from '../src/app/api/control/anime/route';
import { GET as animeGET, PATCH as animePATCH } from '../src/app/api/control/anime/[id]/route';
import { PATCH as personPATCH } from '../src/app/api/control/people/[id]/route';
import { PATCH as studioPATCH } from '../src/app/api/control/studios/[id]/route';

after(async () => {
  await prisma.$disconnect();
});

describe('control center access', () => {
  test('members, moderators and creators are refused; admins get the overview', async () => {
    for (const role of ['USER', 'CREATOR', 'MODERATOR']) {
      const u = await createUser(role);
      const res = await read(await overviewGET(request('GET', '/api/control/overview', { as: u })));
      assert.equal(res.status, 403, `${role} must not see the control center`);
    }
    const anon = await read(await overviewGET(request('GET', '/api/control/overview')));
    assert.equal(anon.status, 401);

    const admin = await createUser('ADMIN');
    const res = await read(await overviewGET(request('GET', '/api/control/overview', { as: admin })));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.users.total, await prisma.user.count());
    assert.equal(res.body.signups.length, 14);
  });

  test('the user list never exposes phone numbers, emails or password data', async () => {
    const admin = await createUser('ADMIN');
    const res = await read(await usersGET(request('GET', '/api/control/users', { as: admin })));
    assert.equal(res.status, 200);
    assert.ok(res.body.users.length > 0);
    const text = JSON.stringify(res.body);
    for (const key of ['"phone"', '"email"', 'passwordHash']) assert.equal(text.includes(key), false, `${key} must not be returned`);
    assert.equal(res.body.canChangeRoles, false, 'only SUPER_ADMIN changes roles');
  });
});

describe('control center anime edits', () => {
  let admin: Awaited<ReturnType<typeof createUser>>;
  let anime: Awaited<ReturnType<typeof createAnime>>;
  before(async () => {
    admin = await createUser('ADMIN');
    anime = await createAnime();
  });

  test('sets banner + trailer, records an editorial override and history', async () => {
    const res = await read(
      await animePATCH(
        request('PATCH', `/api/control/anime/${anime.id}`, {
          as: admin,
          body: { bannerUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/1.jpg', trailerUrl: 'https://youtu.be/dQw4w9WgXcQ' },
        }),
        { params: { id: anime.id } },
      ),
    );
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.changed.sort(), ['bannerUrl', 'trailerUrl']);

    const row = await prisma.anime.findUniqueOrThrow({ where: { id: anime.id } });
    assert.equal(row.trailerUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'trailer normalised to a watch URL');
    const overrides = await prisma.editorialOverride.findMany({ where: { entityType: 'ANIME', entityId: anime.id } });
    assert.deepEqual(overrides.map((o) => o.field).sort(), ['bannerUrl', 'trailerUrl']);
    assert.equal(await prisma.animeMetadataHistory.count({ where: { animeId: anime.id, source: 'control-center' } }), 2);

    const detail = await read(await animeGET(request('GET', `/api/control/anime/${anime.id}`, { as: admin }), { params: { id: anime.id } }));
    assert.equal(detail.status, 200);
    assert.equal(detail.body.overrides.length, 2);
  });

  test('refuses non-https images and non-YouTube trailers', async () => {
    for (const body of [{ posterUrl: 'http://example.com/a.jpg' }, { bannerUrl: 'javascript:alert(1)' }, { trailerUrl: 'https://vimeo.com/123' }]) {
      const res = await read(await animePATCH(request('PATCH', `/api/control/anime/${anime.id}`, { as: admin, body }), { params: { id: anime.id } }));
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  test('clearing a field removes its override (sync may fill it again)', async () => {
    const res = await read(await animePATCH(request('PATCH', `/api/control/anime/${anime.id}`, { as: admin, body: { trailerUrl: '' } }), { params: { id: anime.id } }));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const left = await prisma.editorialOverride.findMany({ where: { entityType: 'ANIME', entityId: anime.id } });
    assert.deepEqual(left.map((o) => o.field), ['bannerUrl']);
  });

  test('a member cannot edit', async () => {
    const user = await createUser('USER');
    const res = await read(await animePATCH(request('PATCH', `/api/control/anime/${anime.id}`, { as: user, body: { bannerUrl: '' } }), { params: { id: anime.id } }));
    assert.equal(res.status, 403);
  });

  test('the list filters anime missing a banner', async () => {
    const res = await read(await animeListGET(request('GET', '/api/control/anime?missing=banner&limit=50', { as: admin })));
    assert.equal(res.status, 200);
    assert.ok(res.body.anime.every((a: { bannerUrl: string | null }) => !a.bannerUrl));
    assert.ok(!res.body.anime.some((a: { id: string }) => a.id === anime.id), 'the edited anime now has a banner');
  });
});

describe('control center people and studio images', () => {
  test('sets a creator photo and a studio logo, each protected by an override', async () => {
    const admin = await createUser('ADMIN');
    const person = await prisma.person.create({ data: { name: 'Test Director', slug: `test-director-${Date.now()}` } });
    const p = await read(await personPATCH(request('PATCH', `/api/control/people/${person.id}`, { as: admin, body: { imageUrl: '/uploads/general/x/photo.webp' } }), { params: { id: person.id } }));
    assert.equal(p.status, 200, JSON.stringify(p.body));
    assert.equal((await prisma.person.findUniqueOrThrow({ where: { id: person.id } })).imageUrl, '/uploads/general/x/photo.webp');
    assert.equal(await prisma.editorialOverride.count({ where: { entityType: 'PERSON', entityId: person.id } }), 1);

    const studio = await prisma.studio.create({ data: { name: `Test Studio ${Date.now()}`, slug: `test-studio-${Date.now()}` } });
    const s = await read(await studioPATCH(request('PATCH', `/api/control/studios/${studio.id}`, { as: admin, body: { logoUrl: 'https://example.com/logo.png' } }), { params: { id: studio.id } }));
    assert.equal(s.status, 200, JSON.stringify(s.body));
    assert.equal((await prisma.studio.findUniqueOrThrow({ where: { id: studio.id } })).adminOverrideImageUrl, 'https://example.com/logo.png');

    const traversal = await read(await personPATCH(request('PATCH', `/api/control/people/${person.id}`, { as: admin, body: { imageUrl: '/uploads/../.env' } }), { params: { id: person.id } }));
    assert.equal(traversal.status, 400);
  });
});
