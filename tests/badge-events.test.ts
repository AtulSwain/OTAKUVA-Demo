import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { createUser } from './helpers/fixtures';
import { request, read } from './helpers/http';
import { recalculateUser } from '../src/lib/badges/countingService';
import { GET, POST } from '../src/app/api/me/badge-events/route';
import { GET as profileBadgesGET } from '../src/app/api/users/[username]/badges/route';

after(async () => {
  await prisma.$disconnect();
});

async function countedReviews(userId: string, n: number) {
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await prisma.anime.createMany({
    data: Array.from({ length: n }, (_, i) => ({
      slug: `ev-${tag}-${i}`, canonicalTitle: `Ev ${tag} ${i}`, synopsis: '', posterUrl: '', externalSource: 'mal', externalId: `ev-${tag}-${i}`,
    })),
  });
  const anime = await prisma.anime.findMany({ where: { slug: { startsWith: `ev-${tag}-` } }, select: { id: true } });
  await prisma.review.createMany({
    data: anime.map((a, i) => ({
      userId, animeId: a.id, title: 't', body: Array.from({ length: 45 }, (_, k) => `w${tag}${i}x${k}`).join(' '),
      watchStatusAtReview: 'COMPLETED', wordCount: 45, countState: 'COUNTED', countedAt: new Date(),
    })),
  });
}

describe('badge events API', () => {
  test('a tier unlock is delivered once, then never again', async () => {
    const u = await createUser();
    await countedReviews(u.id, 10);
    await recalculateUser(u.id);

    const first = await read(await GET(request('GET', '/api/me/badge-events', { as: u })));
    assert.equal(first.body.events.length, 1);
    assert.equal(first.body.events[0].type, 'TIER_EARNED');
    assert.equal(first.body.events[0].tierKey, 'kohai');

    const marked = await read(await POST(request('POST', '/api/me/badge-events', { as: u, body: { ids: [first.body.events[0].id] } })));
    assert.equal(marked.body.marked, 1);

    const second = await read(await GET(request('GET', '/api/me/badge-events', { as: u })));
    assert.equal(second.body.events.length, 0);
  });

  test('events are private to their owner', async () => {
    const a = await createUser();
    const b = await createUser();
    await countedReviews(a.id, 10);
    await recalculateUser(a.id);
    const theirs = await read(await GET(request('GET', '/api/me/badge-events', { as: b })));
    assert.equal(theirs.body.events.length, 0);
    const stolen = await read(await GET(request('GET', '/api/me/badge-events', { as: a })));
    const mark = await read(await POST(request('POST', '/api/me/badge-events', { as: b, body: { ids: [stolen.body.events[0].id] } })));
    assert.equal(mark.body.marked, 0);
  });

  test('joined communities are hidden when the user opts out; founded ones stay', async () => {
    const owner = await createUser();
    const viewer = await createUser();
    const founder = await createUser();
    const founded = await prisma.community.create({ data: { ownerId: founder.id, name: 'F', slug: `f-${Date.now()}`, description: 'x' } });
    const joined = await prisma.community.create({ data: { ownerId: owner.id, name: 'J', slug: `j-${Date.now()}`, description: 'x' } });
    await prisma.communityMember.create({ data: { communityId: founded.id, userId: founder.id, role: 'OWNER', status: 'ACTIVE' } });
    await prisma.communityMember.create({ data: { communityId: joined.id, userId: founder.id, role: 'MEMBER', status: 'ACTIVE' } });
    await prisma.user.update({ where: { id: founder.id }, data: { showJoinedCommunities: false } });

    const call = (as: typeof viewer) =>
      profileBadgesGET(request('GET', `/api/users/${founder.username}/badges`, { as }), { params: { username: founder.username } });
    const other = await read(await call(viewer));
    assert.deepEqual(other.body.communities.map((c: any) => c.slug), [founded.slug]);
    const self = await read(await call(founder));
    assert.equal(self.body.communities.length, 2);
  });
});
