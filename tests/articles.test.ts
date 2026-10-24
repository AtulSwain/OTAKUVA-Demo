import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';

import { GET as listGET, POST as createPOST } from '../src/app/api/articles/route';
import { GET as oneGET, DELETE as oneDELETE } from '../src/app/api/articles/[slug]/route';
import { GET as activityGET } from '../src/app/api/users/[username]/activity/route';

after(async () => {
  await prisma.$disconnect();
});

const BODY =
  'The studio confirmed a second season during a livestream this weekend, along with a teaser visual and a 2027 window. Here is what we know so far.';

const publish = (as: any, body: Record<string, unknown>) => createPOST(request('POST', '/api/articles', { as, body })).then(read);

describe('member articles', () => {
  test('publishing creates an article attributed to its author, with links and related anime', async () => {
    const author = await createUser();
    const anime = await createAnime();
    const res = await publish(author, {
      title: 'Second season officially announced',
      body: BODY,
      animeId: anime.id,
      links: [{ label: 'Official site', url: 'https://example.com/news' }, { url: '' }],
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));

    const one = await read(await oneGET(request('GET', `/api/articles/${res.body.article.slug}`), { params: { slug: res.body.article.slug } }));
    assert.equal(one.status, 200);
    assert.equal(one.body.article.author.username, author.username);
    assert.equal(one.body.article.anime.id, anime.id);
    assert.deepEqual(one.body.article.links, [{ label: 'Official site', url: 'https://example.com/news' }]);

    const mine = await read(await listGET(request('GET', `/api/articles?author=${author.username}`)));
    assert.equal(mine.body.total, 1);

    // Counts as a contribution in the author's activity.
    const act = await read(await activityGET(request('GET', `/api/users/${author.username}/activity`), { params: { username: author.username } }));
    assert.ok(act.body.items.some((a: any) => a.kind === 'ARTICLE'));
    assert.ok(act.body.days.reduce((n: number, d: any) => n + d.count, 0) >= 1);
  });

  test('rejects bad input: short title, short body, non-http links', async () => {
    const author = await createUser();
    assert.equal((await publish(author, { title: 'Short', body: BODY })).status, 400);
    assert.equal((await publish(author, { title: 'A perfectly fine title', body: 'too short' })).status, 400);
    const js = await publish(author, { title: 'A perfectly fine title', body: BODY, links: [{ url: 'javascript:alert(1)' }] });
    assert.equal(js.status, 400);
    assert.equal(await prisma.userArticle.count({ where: { authorId: author.id } }), 0);
  });

  test("can't attach someone else's uploaded image", async () => {
    const owner = await createUser();
    const other = await createUser();
    const asset = await prisma.mediaAsset.create({
      data: { userId: owner.id, type: 'ARTICLE_COVER', source: 'local', sourceUrl: '/uploads/x.webp', storedUrl: '/uploads/x.webp' },
    });
    const res = await publish(other, { title: 'Borrowing an image here', body: BODY, coverAssetId: asset.id });
    assert.equal(res.status, 400);
  });

  test('only the author can delete; a moderator can hide; removed articles disappear from the list', async () => {
    const author = await createUser();
    const stranger = await createUser();
    const mod = await createUser('MODERATOR');
    const a = (await publish(author, { title: 'Article to be removed', body: BODY })).body.article;
    const b = (await publish(author, { title: 'Article to be hidden', body: BODY })).body.article;

    const del = (as: any, slug: string) => oneDELETE(request('DELETE', `/api/articles/${slug}`, { as }), { params: { slug } }).then(read);
    assert.equal((await del(stranger, a.slug)).status, 403);
    assert.equal((await del(author, a.slug)).status, 200);
    assert.equal((await del(mod, b.slug)).status, 200);

    const rows = await prisma.userArticle.findMany({ where: { authorId: author.id }, select: { slug: true, status: true } });
    assert.equal(rows.find((r) => r.slug === a.slug)?.status, 'REMOVED');
    assert.equal(rows.find((r) => r.slug === b.slug)?.status, 'HIDDEN');
    const list = await read(await listGET(request('GET', `/api/articles?author=${author.username}`)));
    assert.equal(list.body.total, 0);
  });
});
