import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';

import { POST as createArticlePOST } from '../src/app/api/articles/route';
import { GET as commentsGET, POST as commentsPOST } from '../src/app/api/articles/[slug]/comments/route';
import { DELETE as commentDELETE } from '../src/app/api/articles/[slug]/comments/[commentId]/route';
import { POST as commentLikePOST, DELETE as commentLikeDELETE } from '../src/app/api/articles/[slug]/comments/[commentId]/like/route';
import { GET as communitiesGET, POST as communitiesPOST } from '../src/app/api/communities/route';
import { PATCH as communityPATCH } from '../src/app/api/communities/[slug]/route';
import { getAnimeCommunityHub } from '../src/lib/community/animeCommunityHub';

after(async () => {
  await prisma.$disconnect();
});

const BODY =
  'The studio confirmed a second season during a livestream this weekend, along with a teaser visual and a 2027 window. Here is what we know so far.';

async function publish(author: any) {
  const res = await read(await createArticlePOST(request('POST', '/api/articles', { as: author, body: { title: 'A member article about the show', body: BODY } })));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.article.slug as string;
}
const p = (slug: string) => ({ params: { slug } });

async function comment(slug: string, as: any, body: string, parentId?: string) {
  return read(await commentsPOST(request('POST', `/api/articles/${slug}/comments`, { as, body: { body, parentId } }), p(slug)));
}
async function list(slug: string, as?: any, sort = 'oldest') {
  return (await read(await commentsGET(request('GET', `/api/articles/${slug}/comments?sort=${sort}`, as ? { as } : {}), p(slug)))).body.comments;
}

describe('article comment replies', () => {
  test('replies nest under their comment; replying to a reply stays one level deep and notifies that person', async () => {
    const author = await createUser();
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    const slug = await publish(author);

    const top = (await comment(slug, a, 'First!')).body.comment;
    const r1 = await comment(slug, b, 'Agreed', top.id);
    assert.equal(r1.status, 201);
    assert.equal(r1.body.comment.parentId, top.id);
    const r2 = await comment(slug, c, '@b no way', r1.body.comment.id);
    assert.equal(r2.body.comment.parentId, top.id, 'a reply to a reply attaches to the thread');

    const threads = await list(slug);
    assert.equal(threads.length, 1);
    assert.deepEqual(threads[0].replies.map((r: any) => r.body), ['Agreed', '@b no way']);

    assert.ok(await prisma.notification.findFirst({ where: { userId: a.id, type: 'ARTICLE_COMMENT_REPLY' } }), 'top commenter hears about the reply');
    assert.ok(await prisma.notification.findFirst({ where: { userId: b.id, type: 'ARTICLE_COMMENT_REPLY' } }), 'the person replied to hears about it');
    assert.equal(await prisma.notification.count({ where: { userId: author.id, type: 'ARTICLE_COMMENT' } }), 3);
  });

  test("the article's author replying to a comment is not notified about their own reply", async () => {
    const author = await createUser();
    const a = await createUser();
    const slug = await publish(author);
    const top = (await comment(slug, a, 'Question?')).body.comment;
    await comment(slug, author, 'Answer.', top.id);
    assert.equal(await prisma.notification.count({ where: { userId: author.id } }), 1); // only a's comment
  });

  test("a reply target must be a visible comment on the same article", async () => {
    const author = await createUser();
    const a = await createUser();
    const slugA = await publish(author);
    const slugB = await publish(author);
    const onB = (await comment(slugB, a, 'Other article')).body.comment;
    assert.equal((await comment(slugA, a, 'Cross reply', onB.id)).status, 404);
    assert.equal((await comment(slugA, a, 'Bad id', 'no-such-comment')).status, 404);
  });

  test('a removed comment with replies stays as a placeholder; without replies it disappears', async () => {
    const author = await createUser();
    const a = await createUser();
    const b = await createUser();
    const slug = await publish(author);
    const withReplies = (await comment(slug, a, 'Has replies')).body.comment;
    await comment(slug, b, 'A reply', withReplies.id);
    const alone = (await comment(slug, a, 'Alone')).body.comment;

    for (const id of [withReplies.id, alone.id]) {
      const res = await commentDELETE(request('DELETE', `/api/articles/${slug}/comments/${id}`, { as: a }), { params: { slug, commentId: id } });
      assert.equal(res.status, 200);
    }
    const threads = await list(slug);
    assert.equal(threads.length, 1);
    assert.equal(threads[0].deleted, true);
    assert.equal(threads[0].body, '');
    assert.equal(threads[0].user, null);
    assert.equal(threads[0].replies.length, 1);
  });
});

describe('article comment likes', () => {
  test('one like per person, reflected in the list for that viewer; guests cannot like', async () => {
    const author = await createUser();
    const a = await createUser();
    const fan = await createUser();
    const slug = await publish(author);
    const c = (await comment(slug, a, 'Nice')).body.comment;
    const params = { params: { slug, commentId: c.id } };
    const url = `/api/articles/${slug}/comments/${c.id}/like`;

    assert.equal((await read(await commentLikePOST(request('POST', url, { as: fan }), params))).body.likeCount, 1);
    assert.equal((await read(await commentLikePOST(request('POST', url, { as: fan }), params))).body.likeCount, 1);
    const mine = await list(slug, fan);
    assert.equal(mine[0].likeCount, 1);
    assert.equal(mine[0].liked, true);
    assert.equal((await list(slug))[0].liked, false);

    assert.deepEqual((await read(await commentLikeDELETE(request('DELETE', url, { as: fan }), params))).body, { liked: false, likeCount: 0 });
    assert.equal((await commentLikePOST(request('POST', url), params)).status, 401);
    assert.equal((await commentLikePOST(request('POST', `/api/articles/${slug}/comments/nope/like`, { as: fan }), { params: { slug, commentId: 'nope' } })).status, 404);
  });

  test('top sort ranks by likes and replies', async () => {
    const author = await createUser();
    const a = await createUser();
    const fan = await createUser();
    const slug = await publish(author);
    const quiet = (await comment(slug, a, 'Quiet')).body.comment;
    const popular = (await comment(slug, a, 'Popular')).body.comment;
    await commentLikePOST(request('POST', `/api/articles/${slug}/comments/${popular.id}/like`, { as: fan }), { params: { slug, commentId: popular.id } });
    assert.deepEqual((await list(slug, undefined, 'top')).map((t: any) => t.id), [popular.id, quiet.id]);
    assert.deepEqual((await list(slug, undefined, 'oldest')).map((t: any) => t.id), [quiet.id, popular.id]);
  });
});

describe('community anime + genre links', () => {
  async function genre(name: string) {
    const n = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return prisma.genre.create({ data: { name: `${name} ${n}`, slug: `${name.toLowerCase()}-${n}` } });
  }

  test('created with an anime and genres; bad or too many genres are a 400; update replaces them', async () => {
    const owner = await createUser();
    const anime = await createAnime();
    const g1 = await genre('Action');
    const g2 = await genre('Drama');

    const created = await read(
      await communitiesPOST(request('POST', '/api/communities', { as: owner, body: { name: 'Saga fans', description: 'All about the saga.', category: 'ANIME', animeId: anime.slug, genreIds: [g1.id, g2.slug] } }))
    );
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.community.id;
    const slug = created.body.community.slug;
    assert.equal(created.body.community.animeId, anime.id);
    assert.equal(await prisma.communityGenre.count({ where: { communityId: id } }), 2);

    const bad = await communitiesPOST(request('POST', '/api/communities', { as: owner, body: { name: 'Bad genres', description: 'Should not work.', genreIds: ['nope'] } }));
    assert.equal(bad.status, 400);
    const many = await Promise.all(['A', 'B', 'C', 'D', 'E', 'F'].map((x) => genre(x)));
    const tooMany = await communitiesPOST(request('POST', '/api/communities', { as: owner, body: { name: 'Too many', description: 'Should not work.', genreIds: many.map((g) => g.id) } }));
    assert.equal(tooMany.status, 400);

    const patched = await communityPATCH(request('PATCH', `/api/communities/${slug}`, { as: owner, body: { animeId: null, genreIds: [g2.id] } }), p(slug));
    assert.equal(patched.status, 200);
    const row = await prisma.community.findUniqueOrThrow({ where: { id }, include: { genres: true } });
    assert.equal(row.animeId, null);
    assert.deepEqual(row.genres.map((g) => g.genreId), [g2.id]);

    const stranger = await createUser();
    assert.equal((await communityPATCH(request('PATCH', `/api/communities/${slug}`, { as: stranger, body: { genreIds: [] } }), p(slug))).status, 403);
  });

  test('?genre= lists communities tagged with it or about an anime in it; search is case-insensitive', async () => {
    const owner = await createUser();
    const g = await genre('Seinen');
    const anime = await createAnime({ canonicalTitle: 'Vinland Test Saga' });
    await prisma.animeGenre.create({ data: { animeId: anime.id, genreId: g.id } });
    const tagged = await prisma.community.create({ data: { ownerId: owner.id, name: 'Tagged club', slug: `tagged-${Date.now()}`, description: 'x', genres: { create: [{ genreId: g.id }] } } });
    const viaAnime = await prisma.community.create({ data: { ownerId: owner.id, name: 'Show club', slug: `show-${Date.now()}`, description: 'x', animeId: anime.id } });
    await prisma.community.create({ data: { ownerId: owner.id, name: 'Unrelated club', slug: `unrelated-${Date.now()}`, description: 'x' } });

    const res = await read(await communitiesGET(request('GET', `/api/communities?genre=${g.slug}`)));
    assert.deepEqual(res.body.communities.map((c: any) => c.id).sort(), [tagged.id, viaAnime.id].sort());
    const search = await read(await communitiesGET(request('GET', '/api/communities?q=show%20CLUB')));
    assert.ok(search.body.communities.some((c: any) => c.id === viaAnime.id));
  });

  test('anime page: its own community first, then genre communities, then communities of similar anime; private ones never', async () => {
    const owner = await createUser();
    const g = await genre('Adventure');
    const anime = await createAnime();
    const similar = await createAnime();
    await prisma.animeGenre.createMany({ data: [{ animeId: anime.id, genreId: g.id }, { animeId: similar.id, genreId: g.id }] });
    const t = Date.now();
    const own = await prisma.community.create({ data: { ownerId: owner.id, name: 'Own', slug: `own-${t}`, description: 'x', animeId: anime.id, memberCount: 1 } });
    const byGenre = await prisma.community.create({ data: { ownerId: owner.id, name: 'Genre', slug: `genre-${t}`, description: 'x', memberCount: 50, genres: { create: [{ genreId: g.id }] } } });
    const bySimilar = await prisma.community.create({ data: { ownerId: owner.id, name: 'Similar', slug: `similar-${t}`, description: 'x', animeId: similar.id, memberCount: 500 } });
    await prisma.community.create({ data: { ownerId: owner.id, name: 'Hidden', slug: `hidden-${t}`, description: 'x', animeId: anime.id, visibility: 'PRIVATE' } });

    const hub = await getAnimeCommunityHub(anime.id, owner.id);
    assert.deepEqual(hub!.communities.map((c) => c.id), [own.id, byGenre.id, bySimilar.id]);
    assert.deepEqual(hub!.communities.map((c) => c.reason), ['anime', 'genre', 'similar']);
    assert.equal(hub!.communityTotal, 3);
    assert.deepEqual(hub!.communities[2].about, { slug: similar.slug, title: similar.canonicalTitle });
    assert.deepEqual(hub!.communities[1].sharedGenres, [g.name]);
    assert.deepEqual(hub!.anime.genreLinks, [{ name: g.name, slug: g.slug }]);
  });
});
