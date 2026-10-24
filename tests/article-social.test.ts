import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createUser } from './helpers/fixtures';

import { POST as createPOST } from '../src/app/api/articles/route';
import { POST as likePOST, DELETE as likeDELETE } from '../src/app/api/articles/[slug]/like/route';
import { GET as commentsGET, POST as commentsPOST } from '../src/app/api/articles/[slug]/comments/route';
import { DELETE as commentDELETE } from '../src/app/api/articles/[slug]/comments/[commentId]/route';
import { POST as discussionPOST } from '../src/app/api/discussions/route';
import { getAnimeCommunityHub } from '../src/lib/community/animeCommunityHub';

after(async () => {
  await prisma.$disconnect();
});

const BODY =
  'The studio confirmed a second season during a livestream this weekend, along with a teaser visual and a 2027 window. Here is what we know so far.';

async function publish(author: any, animeId?: string) {
  const res = await read(await createPOST(request('POST', '/api/articles', { as: author, body: { title: 'A member article about the show', body: BODY, animeId } })));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.article.slug as string;
}
const p = (slug: string) => ({ params: { slug } });

describe('article likes', () => {
  test('one like per person; unlike removes it; guests and unverified accounts cannot like', async () => {
    const author = await createUser();
    const fan = await createUser();
    const slug = await publish(author);

    assert.equal((await read(await likePOST(request('POST', `/api/articles/${slug}/like`, { as: fan }), p(slug)))).body.likeCount, 1);
    assert.equal((await read(await likePOST(request('POST', `/api/articles/${slug}/like`, { as: fan }), p(slug)))).body.likeCount, 1);
    const off = await read(await likeDELETE(request('DELETE', `/api/articles/${slug}/like`, { as: fan }), p(slug)));
    assert.deepEqual(off.body, { liked: false, likeCount: 0 });

    assert.equal((await likePOST(request('POST', `/api/articles/${slug}/like`), p(slug))).status, 401);
    assert.equal((await likePOST(request('POST', '/api/articles/nope/like', { as: fan }), p('nope'))).status, 404);
  });
});

describe('article comments', () => {
  test('a comment is listed, notifies the author, and validates its body', async () => {
    const author = await createUser();
    const fan = await createUser();
    const slug = await publish(author);

    const created = await read(await commentsPOST(request('POST', `/api/articles/${slug}/comments`, { as: fan, body: { body: '  Great write-up!  ' } }), p(slug)));
    assert.equal(created.status, 201);
    assert.equal(created.body.comment.body, 'Great write-up!');

    const list = await read(await commentsGET(request('GET', `/api/articles/${slug}/comments`), p(slug)));
    assert.equal(list.body.comments.length, 1);
    assert.equal(list.body.comments[0].canDelete, false); // anonymous viewer

    const note = await prisma.notification.findFirst({ where: { userId: author.id, type: 'ARTICLE_COMMENT' } });
    assert.ok(note);
    assert.match(note!.linkUrl!, new RegExp(`/articles/${slug}#comment-`));

    assert.equal((await commentsPOST(request('POST', `/api/articles/${slug}/comments`, { as: fan, body: { body: '   ' } }), p(slug))).status, 400);
    assert.equal((await commentsPOST(request('POST', `/api/articles/${slug}/comments`, { as: fan, body: { body: 'x'.repeat(2001) } }), p(slug))).status, 400);
    assert.equal((await commentsPOST(request('POST', `/api/articles/${slug}/comments`, { body: { body: 'hi' } }), p(slug))).status, 401);
  });

  test('only the comment author or a moderator can remove it', async () => {
    const author = await createUser();
    const fan = await createUser();
    const stranger = await createUser();
    const mod = await createUser('MODERATOR');
    const slug = await publish(author);
    const post = async () => (await read(await commentsPOST(request('POST', `/api/articles/${slug}/comments`, { as: fan, body: { body: 'Comment' } }), p(slug)))).body.comment.id;

    const c1 = await post();
    const del = (as: any, id: string) => commentDELETE(request('DELETE', `/api/articles/${slug}/comments/${id}`, { as }), { params: { slug, commentId: id } });
    assert.equal((await del(stranger, c1)).status, 403);
    assert.equal((await del(fan, c1)).status, 200);

    const c2 = await post();
    assert.equal((await del(mod, c2)).status, 200);
    assert.equal((await prisma.userArticleComment.findUniqueOrThrow({ where: { id: c2 } })).status, 'HIDDEN');

    const list = await read(await commentsGET(request('GET', `/api/articles/${slug}/comments`), p(slug)));
    assert.equal(list.body.comments.length, 0);
  });
});

describe('anime discussion section', () => {
  test('shows threads, member articles with counts and related communities — never private threads to outsiders', async () => {
    const genre = await prisma.genre.create({ data: { name: `Saga Genre ${Date.now()}`, slug: `saga-genre-${Date.now()}` } });
    const anime = await createAnime();
    const other = await createAnime();
    await prisma.animeGenre.createMany({ data: [{ animeId: anime.id, genreId: genre.id }, { animeId: other.id, genreId: genre.id }] });
    const owner = await createUser();
    const fan = await createUser();

    const posted = await read(await discussionPOST(request('POST', '/api/discussions', { as: fan, body: { title: 'Episode 5 thoughts', body: 'That ending was something else.', animeId: anime.slug } })));
    assert.equal(posted.status, 201, JSON.stringify(posted.body));

    const privateComm = await prisma.community.create({ data: { ownerId: owner.id, name: 'Secret club', slug: `secret-${Date.now()}`, description: 'x', visibility: 'PRIVATE' } });
    await prisma.discussion.create({ data: { authorId: owner.id, animeId: anime.id, communityId: privateComm.id, title: 'Private thread', body: 'members only' } });
    await prisma.community.create({ data: { ownerId: owner.id, name: `${anime.canonicalTitle} fans`, slug: `fans-${Date.now()}`, description: 'x', animeId: anime.id } });
    await prisma.community.create({ data: { ownerId: owner.id, name: `${genre.name} lovers`, slug: `genre-${Date.now()}`, description: 'x', communityType: 'GENRE' } });
    await prisma.discussion.create({ data: { authorId: owner.id, animeId: other.id, title: 'Same-genre thread', body: 'about another show' } });

    const slug = await publish(owner, anime.id);
    await likePOST(request('POST', `/api/articles/${slug}/like`, { as: fan }), p(slug));

    const hub = await getAnimeCommunityHub(anime.slug, null);
    assert.ok(hub);
    assert.deepEqual(hub!.discussions.map((d) => d.title), ['Episode 5 thoughts']);
    assert.equal(hub!.discussionCount, 1);
    assert.deepEqual(hub!.sameGenre.map((d) => d.title), ['Same-genre thread']);
    assert.deepEqual(hub!.communities.map((c) => c.reason).sort(), ['anime', 'genre']);
    assert.equal(hub!.articles.length, 1);
    assert.equal(hub!.articles[0].likeCount, 1);

    // The private community's owner sees their thread too.
    const ownerView = await getAnimeCommunityHub(anime.id, owner.id);
    assert.equal(ownerView!.discussionCount, 2);
  });

  test('starting a discussion with an unknown anime is a 400, not a server error', async () => {
    const fan = await createUser();
    const res = await discussionPOST(request('POST', '/api/discussions', { as: fan, body: { title: 'Hello there', body: 'Some discussion body.', animeId: 'no-such-anime' } }));
    assert.equal(res.status, 400);
  });
});
