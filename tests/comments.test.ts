import './helpers/setupTestDb';

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { signJwtToken } from '../src/lib/auth';
import { request, read, type TestUser } from './helpers/http';
import { addMember, createCommunity, createDiscussion, createUser } from './helpers/fixtures';
import { mapGiphyObject } from '../src/lib/media/gifProvider';

import { GET as commentsGET, POST as commentsPOST } from '../src/app/api/discussions/[id]/comments/route';
import { GET as discussionGET } from '../src/app/api/discussions/[id]/route';
import { POST as likePOST } from '../src/app/api/comments/[id]/like/route';
import { DELETE as commentDELETE } from '../src/app/api/comments/[id]/route';
import { POST as uploadPOST } from '../src/app/api/uploads/comment-media/route';
import { DELETE as uploadDELETE } from '../src/app/api/uploads/comment-media/[id]/route';
import { GET as gifSearchGET } from '../src/app/api/gifs/search/route';
import { POST as reportPOST } from '../src/app/api/reports/route';

after(async () => {
  await prisma.$disconnect();
});

const post = (as: TestUser, discussionId: string, body: Record<string, unknown>) =>
  commentsPOST(request('POST', `/api/discussions/${discussionId}/comments`, { as, body }), { params: { id: discussionId } });

const list = async (discussionId: string, query = '', as?: TestUser) =>
  read(await commentsGET(request('GET', `/api/discussions/${discussionId}/comments${query}`, { as }), { params: { id: discussionId } }));

function uploadRequest(as: TestUser, file: Buffer, name = 'meme.png', type = 'image/png') {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(file)], { type }), name);
  const headers = new Headers({ cookie: `anilog_token=${signJwtToken({ userId: as.id, username: as.username, email: as.email })}` });
  return new NextRequest('http://localhost:3000/api/uploads/comment-media', { method: 'POST', body: form, headers });
}

const png = () => sharp({ create: { width: 40, height: 30, channels: 3, background: '#c96a72' } }).png().toBuffer();

describe('threads', () => {
  let owner: any, a: any, b: any, c: any, outsider: any, community: any, discussion: any;

  before(async () => {
    [owner, a, b, c, outsider] = await Promise.all([createUser(), createUser(), createUser(), createUser(), createUser()]);
    community = await createCommunity(owner, 'PRIVATE');
    for (const u of [a, b, c]) await addMember(community.id, u);
    discussion = await createDiscussion(owner, community.id);
  });

  test('replies thread under their root, notify the person replied to, and are never listed twice', async () => {
    const root = (await read(await post(a, discussion.id, { content: 'That final scene was insane.' }))).body.comment;
    const reply = (await read(await post(b, discussion.id, { content: 'Honestly the animation was incredible.', parentId: root.id }))).body.comment;
    // Replying to a reply stays in the same thread, one level deep.
    const nested = (await read(await post(c, discussion.id, { content: '@' + b.username + ' agreed', parentId: reply.id }))).body.comment;
    assert.equal(reply.parentId, root.id);
    assert.equal(nested.parentId, root.id);

    const notes = async (u: any) => prisma.notification.findMany({ where: { userId: u.id }, select: { type: true, title: true } });
    assert.ok((await notes(a)).some((n) => n.type === 'REPLY_COMMENT' && n.title === `${b.username} replied to your comment`));
    const bNotes = await notes(b);
    assert.equal(bNotes.filter((n) => n.type === 'REPLY_COMMENT').length, 1, 'B notified once for the reply, not again for the @mention');
    assert.equal((await notes(owner)).filter((n) => n.type === 'REPLY_DISCUSSION').length, 3);

    const top = await list(discussion.id, '', a);
    assert.equal(top.status, 200);
    assert.deepEqual(top.body.comments.map((x: any) => x.id), [root.id], 'only top-level comments at the top level');
    assert.equal(top.body.comments[0].replyCount, 2);
    assert.equal(top.body.totalComments, 3);

    const replies = await list(discussion.id, `?parentId=${root.id}`, a);
    assert.deepEqual(replies.body.comments.map((x: any) => x.id), [reply.id, nested.id], 'replies oldest first');

    const detail = await read(await discussionGET(request('GET', `/api/discussions/${discussion.id}`, { as: a }), { params: { id: discussion.id } }));
    assert.equal(detail.body.discussion.comments, undefined, 'comments are no longer embedded in the detail payload');
  });

  test('outsiders can neither read, post, nor like', async () => {
    assert.equal((await list(discussion.id, '', outsider)).status, 403);
    assert.equal((await post(outsider, discussion.id, { content: 'hi' })).status, 403);
    const anyComment = await prisma.discussionComment.findFirstOrThrow({ where: { discussionId: discussion.id } });
    assert.equal((await likePOST(request('POST', `/api/comments/${anyComment.id}/like`, { as: outsider }), { params: { id: anyComment.id } })).status, 403);
  });

  test('pagination returns each comment exactly once', async () => {
    const d = await createDiscussion(owner, community.id);
    for (let i = 0; i < 5; i++) await post(a, d.id, { content: `comment ${i}` });
    const seen: string[] = [];
    let cursor = '';
    for (let guard = 0; guard < 10; guard++) {
      const page = await list(d.id, `?sort=newest&limit=2${cursor ? `&cursor=${cursor}` : ''}`, a);
      seen.push(...page.body.comments.map((x: any) => x.id));
      if (!page.body.nextCursor) break;
      cursor = page.body.nextCursor;
    }
    assert.equal(seen.length, 5);
    assert.equal(new Set(seen).size, 5);
  });

  test('likes toggle and count', async () => {
    const cm = (await read(await post(a, discussion.id, { content: 'likeable' }))).body.comment;
    const like = async (u: any) => read(await likePOST(request('POST', `/api/comments/${cm.id}/like`, { as: u }), { params: { id: cm.id } }));
    assert.deepEqual((await like(b)).body, { liked: true, likeCount: 1 });
    assert.deepEqual((await like(c)).body, { liked: true, likeCount: 2 });
    assert.deepEqual((await like(b)).body, { liked: false, likeCount: 1 });
    const listed = (await list(discussion.id, '?sort=newest', c)).body.comments.find((x: any) => x.id === cm.id);
    assert.equal(listed.likedByViewer, true);
    assert.equal(listed.likeCount, 1);
  });

  test('only the author or a moderator can delete; a deleted comment with replies stays as a tombstone', async () => {
    const mod = await createUser();
    await addMember(community.id, mod, 'MODERATOR');
    const root = (await read(await post(a, discussion.id, { content: 'to be deleted' }))).body.comment;
    await post(b, discussion.id, { content: 'reply keeps the thread', parentId: root.id });
    const del = (u: any, id: string) => commentDELETE(request('DELETE', `/api/comments/${id}`, { as: u, body: {} }), { params: { id } });

    assert.equal((await del(b, root.id)).status, 403);
    assert.equal((await del(a, root.id)).status, 200);
    const tomb = (await list(discussion.id, '?sort=newest', a)).body.comments.find((x: any) => x.id === root.id);
    assert.equal(tomb.isDeleted, true);
    assert.equal(tomb.body, null);
    assert.equal(tomb.author, null);

    const other = (await read(await post(b, discussion.id, { content: 'moderated' }))).body.comment;
    assert.equal((await del(mod, other.id)).status, 200);
    assert.ok(await prisma.moderationAction.findFirst({ where: { targetId: other.id, action: 'DELETE', moderatorId: mod.id } }));
  });
});

describe('comment media', () => {
  let owner: any, a: any, b: any, discussion: any;
  before(async () => {
    [owner, a, b] = await Promise.all([createUser(), createUser(), createUser()]);
    discussion = await createDiscussion(owner, null);
  });

  test('an uploaded image is stored, attached by its owner, and shown on the comment', async () => {
    const up = await read(await uploadPOST(uploadRequest(a, await png())));
    assert.equal(up.status, 201);
    assert.equal(up.body.media.type, 'IMAGE');
    const file = path.join(process.env.LOCAL_UPLOADS_ROOT!, up.body.media.url.replace(/^\/uploads\//, ''));
    assert.ok(fs.existsSync(file), 'object written to storage');
    assert.equal((await sharp(file).metadata()).format, 'webp', 're-encoded to WebP');

    // Someone else cannot attach or discard it.
    assert.equal((await post(b, discussion.id, { content: 'stolen', mediaIds: [up.body.media.id] })).status, 400);
    assert.equal((await uploadDELETE(request('DELETE', `/api/uploads/comment-media/${up.body.media.id}`, { as: b }), { params: { id: up.body.media.id } })).status, 404);

    const created = await read(await post(a, discussion.id, { content: '', mediaIds: [up.body.media.id], mediaIsSpoiler: true }));
    assert.equal(created.status, 201, 'an image-only comment (a meme) is allowed');
    assert.equal(created.body.comment.media.length, 1);
    assert.equal(created.body.comment.media[0].isSpoiler, true);
    const row = await prisma.commentMedia.findUniqueOrThrow({ where: { id: up.body.media.id }, include: { asset: true } });
    assert.equal(row.commentId, created.body.comment.id);
    assert.equal(row.asset?.userId, a.id);

    // Already attached: can't be re-attached elsewhere.
    assert.equal((await post(a, discussion.id, { content: 'again', mediaIds: [up.body.media.id] })).status, 400);
  });

  test('an animated GIF upload stays animated and is typed GIF', async () => {
    const frame = (c: string) => sharp({ create: { width: 24, height: 24, channels: 3, background: c } }).png().toBuffer();
    const gif = await sharp([await frame('#ff0000'), await frame('#0000ff')], { join: { animated: true } }).gif().toBuffer();
    const up = await read(await uploadPOST(uploadRequest(a, gif, 'reaction.gif', 'image/gif')));
    assert.equal(up.status, 201);
    assert.equal(up.body.media.type, 'GIF');
    const file = path.join(process.env.LOCAL_UPLOADS_ROOT!, up.body.media.url.replace(/^\/uploads\//, ''));
    assert.equal((await sharp(file, { animated: true }).metadata()).pages, 2);
  });

  test('files are judged by content, not by name or declared type', async () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>'.padEnd(64, ' '));
    assert.equal((await uploadPOST(uploadRequest(a, html, 'cat.png', 'image/png'))).status, 400);
    const fakePng = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]);
    assert.equal((await uploadPOST(uploadRequest(a, fakePng, 'broken.png'))).status, 400);
    assert.equal((await uploadPOST(request('POST', '/api/uploads/comment-media'))).status, 401);
  });

  test('an owner can discard an unposted upload, which removes the stored file', async () => {
    const up = await read(await uploadPOST(uploadRequest(a, await png())));
    const file = path.join(process.env.LOCAL_UPLOADS_ROOT!, up.body.media.url.replace(/^\/uploads\//, ''));
    const res = await uploadDELETE(request('DELETE', `/api/uploads/comment-media/${up.body.media.id}`, { as: a }), { params: { id: up.body.media.id } });
    assert.equal(res.status, 200);
    assert.equal(fs.existsSync(file), false);
    assert.equal(await prisma.commentMedia.count({ where: { id: up.body.media.id } }), 0);
  });

  test('GIF search says when it is not configured; provider URLs are the only ones accepted', async () => {
    const res = await read(await gifSearchGET(request('GET', '/api/gifs/search?q=wow', { as: a })));
    assert.deepEqual(res.body, { configured: false, results: [] });
    assert.equal((await post(a, discussion.id, { content: 'gif', gifIds: ['abc123'] })).status, 503);

    assert.equal(mapGiphyObject({ id: 'abc123', images: { fixed_height: { url: 'https://evil.example/x.gif' } } }), null);
    const ok = mapGiphyObject({
      id: 'abc123',
      title: 'wow',
      images: { fixed_height: { url: 'https://media2.giphy.com/media/abc123/200.gif', width: '356', height: '200' } },
    });
    assert.equal(ok?.url, 'https://media2.giphy.com/media/abc123/200.gif');
    assert.equal(ok?.width, 356);
  });
});

describe('reports', () => {
  test('reports need a real category and a target the reporter can see', async () => {
    const owner = await createUser();
    const member = await createUser();
    const outsider = await createUser();
    const community = await createCommunity(owner, 'PRIVATE');
    await addMember(community.id, member);
    const d = await createDiscussion(owner, community.id);
    const cm = (await read(await post(member, d.id, { content: 'spoilers ahead' }))).body.comment;

    const report = (as: any, body: any) => reportPOST(request('POST', '/api/reports', { as, body }));
    assert.equal((await report(owner, { targetType: 'COMMENT', targetId: cm.id, reason: 'MADE_UP' })).status, 400);
    assert.equal((await report(outsider, { targetType: 'COMMENT', targetId: cm.id, reason: 'SPOILER' })).status, 404);
    assert.equal((await report(owner, { targetType: 'COMMENT', targetId: cm.id, reason: 'SPOILER' })).status, 201);
    const again = await read(await report(owner, { targetType: 'COMMENT', targetId: cm.id, reason: 'SPAM' }));
    assert.equal(again.body.alreadyReported, true);
  });
});
