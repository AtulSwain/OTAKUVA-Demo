import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';
import { getSharedList } from '../src/lib/lists/listService';

import { GET as listsGET, POST as listsPOST } from '../src/app/api/lists/route';
import { GET as listGET, PATCH as listPATCH, DELETE as listDELETE } from '../src/app/api/lists/[id]/route';
import { POST as itemsPOST } from '../src/app/api/lists/[id]/items/route';
import { DELETE as itemDELETE } from '../src/app/api/lists/[id]/items/[animeId]/route';

after(async () => {
  await prisma.$disconnect();
});

const create = async (as: any, body: Record<string, unknown>) => read(await listsPOST(request('POST', '/api/lists', { as, body })));
const add = (as: any, id: string, animeId: string) =>
  itemsPOST(request('POST', `/api/lists/${id}/items`, { as, body: { animeId } }), { params: { id } });
const remove = (as: any, id: string, animeId: string) =>
  itemDELETE(request('DELETE', `/api/lists/${id}/items/${animeId}`, { as }), { params: { id, animeId } });
const patch = async (as: any, id: string, body: Record<string, unknown>) =>
  read(await listPATCH(request('PATCH', `/api/lists/${id}`, { as, body }), { params: { id } }));

describe('custom lists', () => {
  test('a new list is private by default and can start with an anime', async () => {
    const user = await createUser();
    const anime = await createAnime();
    const { status, body } = await create(user, { name: '  Horror   night ', animeId: anime.slug });
    assert.equal(status, 200);
    assert.equal(body.list.name, 'Horror night', 'name is trimmed and whitespace collapsed');
    assert.equal(body.list.visibility, 'PRIVATE');
    assert.equal(body.list.shareToken, null);
    assert.equal(body.list.count, 1);
  });

  test('adding the same anime twice is a no-op; removing works', async () => {
    const user = await createUser();
    const anime = await createAnime();
    const { body } = await create(user, { name: 'Watch later' });
    const id = body.list.id;

    assert.equal((await add(user, id, anime.id)).status, 201);
    const again = await read(await add(user, id, anime.id));
    assert.equal(again.status, 200);
    assert.equal(again.body.added, false);
    assert.equal(again.body.count, 1);

    const removed = await read(await remove(user, id, anime.id));
    assert.equal(removed.body.removed, true);
    assert.equal(removed.body.count, 0);
  });

  test('the picker shows which lists already contain an anime', async () => {
    const user = await createUser();
    const anime = await createAnime();
    await create(user, { name: 'Has it', animeId: anime.id });
    await create(user, { name: 'Does not' });
    const { body } = await read(await listsGET(request('GET', `/api/lists?mine=1&containsAnimeId=${anime.id}`, { as: user })));
    const byName = Object.fromEntries(body.lists.map((l: any) => [l.name, l.containsAnime]));
    assert.deepEqual(byName, { 'Has it': true, 'Does not': false });
  });

  test('other users can neither read nor change someone else’s list', async () => {
    const owner = await createUser();
    const other = await createUser();
    const anime = await createAnime();
    const { body } = await create(owner, { name: 'Mine' });
    const id = body.list.id;

    assert.equal((await listGET(request('GET', `/api/lists/${id}`, { as: other }), { params: { id } })).status, 404);
    assert.equal((await patch(other, id, { name: 'Hijacked' })).status, 404);
    assert.equal((await add(other, id, anime.id)).status, 404);
    assert.equal((await listDELETE(request('DELETE', `/api/lists/${id}`, { as: other }), { params: { id } })).status, 404);
    assert.equal((await prisma.userList.findUnique({ where: { id } }))?.name, 'Mine');
    assert.equal((await listGET(request('GET', `/api/lists/${id}`), { params: { id } })).status, 401);
  });

  test('sharing issues a random token; regenerating rotates it; going private revokes it', async () => {
    const user = await createUser();
    const anime = await createAnime();
    const { body } = await create(user, { name: 'Shareable', animeId: anime.id });
    const id = body.list.id;
    assert.equal(await getSharedList(id), null, 'the list id is not a share link');

    const shared = await patch(user, id, { visibility: 'LINK' });
    const token = shared.body.list.shareToken;
    assert.ok(typeof token === 'string' && token.length >= 20);
    assert.notEqual(token, id);
    const view = await getSharedList(token);
    assert.equal(view?.name, 'Shareable');
    assert.equal(view?.items.length, 1);

    const rotated = await patch(user, id, { regenerateLink: true });
    assert.notEqual(rotated.body.list.shareToken, token);
    assert.equal(await getSharedList(token), null, 'the old link stops working');

    const priv = await patch(user, id, { visibility: 'PRIVATE' });
    assert.equal(priv.body.list.shareToken, null);
    assert.equal(await getSharedList(rotated.body.list.shareToken), null);
  });

  test('LINK lists are not listed on the owner’s profile; PUBLIC ones are', async () => {
    const owner = await createUser();
    const viewer = await createUser();
    await create(owner, { name: 'Link only', visibility: 'LINK' });
    await create(owner, { name: 'On profile', visibility: 'PUBLIC' });
    const { body } = await read(await listsGET(request('GET', `/api/lists?userId=${owner.id}`, { as: viewer })));
    assert.deepEqual(body.lists.map((l: any) => l.name), ['On profile']);
  });

  test('input is validated', async () => {
    const user = await createUser();
    assert.equal((await create(user, { name: '' })).status, 400);
    assert.equal((await create(user, { name: 'x'.repeat(61) })).status, 400);
    assert.equal((await create(user, { name: 'ok', animeId: 'no-such-anime' })).status, 404);
    const { body } = await create(user, { name: 'Valid' });
    assert.equal((await patch(user, body.list.id, { visibility: 'EVERYONE' })).status, 400);
    assert.equal((await read(await listsGET(request('GET', '/api/lists?mine=1')))).status, 401);
  });

  test('deleting a list removes it and its items, but never the anime', async () => {
    const user = await createUser();
    const anime = await createAnime();
    const { body } = await create(user, { name: 'Temporary', animeId: anime.id });
    const id = body.list.id;
    assert.equal((await listDELETE(request('DELETE', `/api/lists/${id}`, { as: user }), { params: { id } })).status, 200);
    assert.equal(await prisma.userList.findUnique({ where: { id } }), null);
    assert.equal(await prisma.userListItem.count({ where: { listId: id } }), 0);
    assert.ok(await prisma.anime.findUnique({ where: { id: anime.id } }));
  });
});

describe('collections (lists with a banner, 2026-10-22)', () => {
  const BANNER = 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/1-test.jpg';

  test('a collection can start with several anime and use one of their banners', async () => {
    const user = await createUser();
    const a = await createAnime({ bannerUrl: BANNER });
    const b = await createAnime();
    const { status, body } = await create(user, { name: 'Weekend binge', visibility: 'PUBLIC', animeIds: [a.slug, b.id, a.id], bannerAnimeId: a.id });
    assert.equal(status, 200);
    assert.equal(body.list.count, 2, 'duplicates collapse');
    assert.equal(body.list.bannerUrl, BANNER);
    assert.ok(body.list.shareToken, 'public collections get a link');
  });

  test('banner must be an anime in the collection, or the owner’s own uploaded asset', async () => {
    const owner = await createUser();
    const other = await createUser();
    const inIt = await createAnime({ bannerUrl: BANNER });
    const outside = await createAnime({ bannerUrl: BANNER });
    const notIn = await create(owner, { name: 'X', animeIds: [inIt.id], bannerAnimeId: outside.id });
    assert.equal(notIn.status, 400);
    const othersAsset = await prisma.mediaAsset.create({ data: { userId: other.id, type: 'LIST_BANNER', source: 'local', sourceUrl: '/u/x.webp', storedUrl: '/u/x.webp' } });
    assert.equal((await create(owner, { name: 'Y', animeIds: [inIt.id], bannerAssetId: othersAsset.id })).status, 400);
    const wrongType = await prisma.mediaAsset.create({ data: { userId: owner.id, type: 'ARTICLE_COVER', source: 'local', sourceUrl: '/u/y.webp', storedUrl: '/u/y.webp' } });
    assert.equal((await create(owner, { name: 'Z', animeIds: [inIt.id], bannerAssetId: wrongType.id })).status, 400);
    const mine = await prisma.mediaAsset.create({ data: { userId: owner.id, type: 'LIST_BANNER', source: 'local', sourceUrl: '/u/z.webp', storedUrl: '/u/z.webp' } });
    const ok = await create(owner, { name: 'Mine', animeIds: [inIt.id], bannerAssetId: mine.id });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.list.bannerUrl, '/u/z.webp');
    // A raw URL is never accepted.
    const raw = await create(owner, { name: 'Raw', animeIds: [inIt.id], bannerUrl: 'https://evil.example/x.png' });
    assert.equal(raw.status, 200);
    assert.equal(raw.body.list.bannerUrl, BANNER, 'ignored → falls back to the anime banner');
  });

  test('the owner can change and clear the banner; others cannot', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const a = await createAnime({ bannerUrl: BANNER });
    const { body } = await create(owner, { name: 'C', animeIds: [a.id] });
    const id = body.list.id;
    assert.equal((await patch(stranger, id, { bannerAnimeId: a.id })).status, 404);
    const set = await patch(owner, id, { bannerAnimeId: a.id });
    assert.equal(set.status, 200);
    assert.equal(set.body.list.bannerChosen, true);
    const cleared = await patch(owner, id, { banner: null });
    assert.equal(cleared.body.list.bannerChosen, false);
    assert.equal(cleared.body.list.bannerUrl, BANNER, 'derived from its anime');
  });

  test('only non-empty PUBLIC collections are listed publicly', async () => {
    const { GET: publicGET } = await import('../src/app/api/collections/public/route');
    const user = await createUser();
    const a = await createAnime();
    const pub = (await create(user, { name: 'Pub', visibility: 'PUBLIC', animeIds: [a.id] })).body.list;
    const priv = (await create(user, { name: 'Priv', visibility: 'PRIVATE', animeIds: [a.id] })).body.list;
    const link = (await create(user, { name: 'Link', visibility: 'LINK', animeIds: [a.id] })).body.list;
    const empty = (await create(user, { name: 'Empty', visibility: 'PUBLIC' })).body.list;
    const res = await read(await publicGET(request('GET', '/api/collections/public?limit=48')));
    const ids = res.body.items.map((i: any) => i.id);
    assert.ok(ids.includes(pub.id));
    assert.ok(!ids.includes(priv.id) && !ids.includes(link.id) && !ids.includes(empty.id));
    const item = res.body.items.find((i: any) => i.id === pub.id);
    assert.equal(item.owner.username, user.username);
    assert.equal(typeof item.shareToken, 'string');
  });
});
