import './helpers/setupTestDb';

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { addMember, createCommunity, createDiscussion, createUser } from './helpers/fixtures';

import { POST as syncPOST } from '../src/app/api/sync/route';
import { POST as adminImagesPOST, GET as adminImagesGET } from '../src/app/api/admin/images/route';
import { POST as importPOST } from '../src/app/api/admin/anime/import/route';
import { GET as adminDataGET } from '../src/app/api/admin/data/route';
import { GET as reviewQueueGET } from '../src/app/api/admin/news/review/route';
import { GET as postsGET } from '../src/app/api/communities/[slug]/posts/route';
import { GET as membersGET } from '../src/app/api/communities/[slug]/members/route';
import { GET as discussionsGET } from '../src/app/api/discussions/route';
import { GET as discussionGET } from '../src/app/api/discussions/[id]/route';
import { POST as commentPOST } from '../src/app/api/discussions/[id]/comments/route';
import { POST as reactionPOST } from '../src/app/api/discussions/[id]/reactions/route';
import { GET as listsGET, POST as listsPOST } from '../src/app/api/lists/route';
import { GET as statsGET } from '../src/app/api/stats/route';
import { POST as joinPOST } from '../src/app/api/communities/[slug]/join/route';
import { POST as requestsPOST } from '../src/app/api/communities/[slug]/requests/route';
import { POST as newsPOST } from '../src/app/api/news/route';

after(async () => {
  await prisma.$disconnect();
});

describe('admin and sync endpoints', () => {
  test('catalog-writing endpoints reject anonymous callers and plain users', async () => {
    const user = await createUser('USER');
    for (const [name, call] of [
      ['POST /api/sync', (as?: any) => syncPOST(request('POST', '/api/sync', { as }))],
      ['POST /api/admin/images', (as?: any) => adminImagesPOST(request('POST', '/api/admin/images', { as, body: { action: 'repair' } }))],
      ['GET /api/admin/images', (as?: any) => adminImagesGET(request('GET', '/api/admin/images', { as }))],
      ['POST /api/admin/anime/import', (as?: any) => importPOST(request('POST', '/api/admin/anime/import', { as, body: { action: 'reset' } }))],
      ['GET /api/admin/data', (as?: any) => adminDataGET(request('GET', '/api/admin/data', { as }))],
      // Was open to anyone: an anonymous POST ran a full provider news sync.
      ['POST /api/news (sync)', (as?: any) => newsPOST(request('POST', '/api/news', { as, body: { provider: 'all', limit: 100000 } }))],
      ['POST /api/news (manual entry)', (as?: any) => newsPOST(request('POST', '/api/news', { as, body: { isManual: true, title: 'x' } }))],
    ] as const) {
      assert.equal((await call()).status, 401, `${name} anonymous`);
      assert.equal((await call(user)).status, 403, `${name} as USER`);
    }
  });

  test('news review queue admits NEWS_EDITOR and SUPER_ADMIN, not MODERATOR', async () => {
    const call = async (role: string) =>
      (await reviewQueueGET(request('GET', '/api/admin/news/review', { as: await createUser(role) }))).status;
    assert.equal(await call('MODERATOR'), 403);
    assert.notEqual(await call('NEWS_EDITOR'), 403);
    assert.notEqual(await call('SUPER_ADMIN'), 403);
  });
});

describe('private community content', () => {
  let owner: any, member: any, outsider: any, banned: any, privateCommunity: any, publicCommunity: any;
  let privateThread: any, publicThread: any, threadElsewhere: any;

  before(async () => {
    owner = await createUser();
    member = await createUser();
    outsider = await createUser();
    banned = await createUser();
    privateCommunity = await createCommunity(owner, 'PRIVATE');
    publicCommunity = await createCommunity(owner, 'PUBLIC');
    await addMember(privateCommunity.id, member);
    await addMember(privateCommunity.id, banned);
    await prisma.communityBan.create({ data: { communityId: privateCommunity.id, userId: banned.id, createdBy: owner.id } });
    privateThread = await createDiscussion(owner, privateCommunity.id);
    publicThread = await createDiscussion(owner, publicCommunity.id);
    threadElsewhere = await createDiscussion(owner, publicCommunity.id);
  });

  const slugParams = () => ({ params: { slug: privateCommunity.slug } });

  test('posts and members of a PRIVATE community are hidden from non-members', async () => {
    for (const as of [undefined, outsider, banned]) {
      assert.equal((await postsGET(request('GET', `/api/communities/${privateCommunity.slug}/posts`, { as }), slugParams())).status, 403);
      assert.equal((await membersGET(request('GET', `/api/communities/${privateCommunity.slug}/members`, { as }), slugParams())).status, 403);
    }
    const res = await read(await postsGET(request('GET', `/api/communities/${privateCommunity.slug}/posts`, { as: member }), slugParams()));
    assert.equal(res.status, 200);
    assert.ok(res.body.discussions.some((d: any) => d.id === privateThread.id));
  });

  test('a private thread cannot be opened directly by id, reacted to, or seen in the global list', async () => {
    const detail = (as?: any) => discussionGET(request('GET', `/api/discussions/${privateThread.id}`, { as }), { params: { id: privateThread.id } });
    assert.equal((await detail()).status, 403);
    assert.equal((await detail(outsider)).status, 403);
    assert.equal((await detail(member)).status, 200);
    assert.equal(
      (await reactionPOST(request('POST', `/api/discussions/${privateThread.id}/reactions`, { as: outsider }), { params: { id: privateThread.id } })).status,
      403
    );

    const listIds = async (as?: any) =>
      (await read(await discussionsGET(request('GET', '/api/discussions?limit=50', { as })))).body.discussions.map((d: any) => d.id);
    assert.ok(!(await listIds()).includes(privateThread.id));
    assert.ok(!(await listIds(outsider)).includes(privateThread.id));
    assert.ok((await listIds(member)).includes(privateThread.id));
    assert.ok((await listIds()).includes(publicThread.id));
  });

  test('discussion search works and is case-insensitive', async () => {
    // Originally just guarded against a 500 (`mode: 'insensitive'` used to
    // be omitted because the SQLite connector rejected it outright — see
    // the route's comment). Query in a different case than the fixture
    // title ("A test discussion") so this actually exercises
    // case-insensitivity, not just "doesn't crash" — a same-case query
    // would still pass even with the case-sensitivity regression the
    // Postgres migration introduced everywhere `mode: 'insensitive'` was
    // missing (see CLAUDE.md).
    const res = await read(await discussionsGET(request('GET', '/api/discussions?q=TEST')));
    assert.equal(res.status, 200);
    assert.ok(res.body.discussions.some((d: any) => d.id === publicThread.id));
  });

  test('replying in a community requires active membership, and parentId must belong to the thread', async () => {
    const reply = (as: any, id: string, body: any) =>
      commentPOST(request('POST', `/api/discussions/${id}/comments`, { as, body }), { params: { id } });

    assert.equal((await reply(outsider, privateThread.id, { content: 'hi' })).status, 403);
    assert.equal((await reply(banned, privateThread.id, { content: 'hi' })).status, 403);
    assert.equal((await reply(outsider, publicThread.id, { content: 'hi' })).status, 403, 'not a member of the public community either');
    assert.equal((await reply(member, privateThread.id, { content: 'hello' })).status, 201);

    await addMember(publicCommunity.id, member);
    const other = await read(await reply(member, threadElsewhere.id, { content: 'elsewhere' }));
    assert.equal(other.status, 201);
    const borrowed = await reply(member, publicThread.id, { content: 'reply', parentId: other.body.comment?.id ?? other.body.id });
    assert.equal(borrowed.status, 400);

    await prisma.discussion.update({ where: { id: publicThread.id }, data: { status: 'LOCKED' } });
    assert.equal((await reply(member, publicThread.id, { content: 'late' })).status, 403);
  });
});

describe('join requests', () => {
  test('pending users gain nothing; admins of one community cannot approve another; nobody approves themselves', async () => {
    const ownerX = await createUser();
    const ownerY = await createUser();
    const applicant = await createUser();
    const x = await createCommunity(ownerX, 'PRIVATE', 'APPROVAL_REQUIRED');
    const y = await createCommunity(ownerY, 'PRIVATE', 'APPROVAL_REQUIRED');
    await createDiscussion(ownerX, x.id);

    const joined = await read(await joinPOST(request('POST', `/api/communities/${x.slug}/join`, { as: applicant }), { params: { slug: x.slug } }));
    assert.equal(joined.status, 200);
    const pending = await prisma.communityJoinRequest.findUnique({ where: { communityId_userId: { communityId: x.id, userId: applicant.id } } });
    assert.equal(pending?.status, 'PENDING');

    // Still locked out while pending.
    assert.equal((await postsGET(request('GET', `/api/communities/${x.slug}/posts`, { as: applicant }), { params: { slug: x.slug } })).status, 403);

    const review = (as: any, slug: string, userId: string) =>
      requestsPOST(request('POST', `/api/communities/${slug}/requests`, { as, body: { userId, action: 'APPROVE' } }), { params: { slug } });

    assert.equal((await review(applicant, x.slug, applicant.id)).status, 403, 'self-approval');
    assert.notEqual((await review(ownerY, x.slug, applicant.id)).status, 200, 'owner of Y approving for X');
    assert.equal((await prisma.communityJoinRequest.findUnique({ where: { communityId_userId: { communityId: x.id, userId: applicant.id } } }))?.status, 'PENDING');

    assert.equal((await review(ownerX, x.slug, applicant.id)).status, 200);
    assert.equal((await postsGET(request('GET', `/api/communities/${x.slug}/posts`, { as: applicant }), { params: { slug: x.slug } })).status, 200);
    // Approval in X grants nothing in Y.
    assert.equal((await postsGET(request('GET', `/api/communities/${y.slug}/posts`, { as: applicant }), { params: { slug: y.slug } })).status, 403);
  });
});

describe('lists and stats', () => {
  test("another user's PRIVATE lists are never returned; lists are created as the session user", async () => {
    const alice = await createUser();
    const bob = await createUser();
    assert.equal((await listsPOST(request('POST', '/api/lists', { body: { name: 'anon' } }))).status, 401);

    const created = await read(await listsPOST(request('POST', '/api/lists', { as: alice, body: { name: 'Secret list', visibility: 'PRIVATE', userId: bob.id } })));
    assert.equal(created.status, 200);
    assert.equal(created.body.list.userId, alice.id, 'body userId is ignored');
    await listsPOST(request('POST', '/api/lists', { as: alice, body: { name: 'Public list', visibility: 'PUBLIC' } }));

    const asBob = await read(await listsGET(request('GET', `/api/lists?userId=${alice.id}`, { as: bob })));
    assert.deepEqual(asBob.body.lists.map((l: any) => l.name), ['Public list']);
    const asAlice = await read(await listsGET(request('GET', `/api/lists?userId=${alice.id}`, { as: alice })));
    assert.equal(asAlice.body.lists.length, 2);
  });

  test('stats require a session', async () => {
    assert.equal((await statsGET(request('GET', '/api/stats'))).status, 401);
    assert.equal((await statsGET(request('GET', '/api/stats', { as: await createUser() }))).status, 200);
  });
});
