import './helpers/setupTestDb';
// These tests exercise the 1–10 star rating, which is switched off by default (2026-10-25).
process.env.STAR_RATINGS_ENABLED = 'true';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { request, read } from './helpers/http';
import { createAnime, createCommunity as createCommunityFixture, createUser } from './helpers/fixtures';
import { hashAccessKey } from '../src/lib/community/invitations';

import { POST as upgradePOST } from '../src/app/api/creator/upgrade/route';
import { GET as dashboardGET } from '../src/app/api/creator/dashboard/route';
import { GET as myReviewsGET, POST as creatorReviewPOST } from '../src/app/api/creator/reviews/route';
import { PATCH as creatorReviewPATCH } from '../src/app/api/creator/reviews/[id]/route';
import { GET as communitiesGET, POST as communitiesPOST } from '../src/app/api/communities/route';
import { GET as communityGET, PATCH as communityPATCH } from '../src/app/api/communities/[slug]/route';
import { POST as joinPOST } from '../src/app/api/communities/[slug]/join/route';
import { GET as membersGET } from '../src/app/api/communities/[slug]/members/route';
import { DELETE as memberDELETE } from '../src/app/api/communities/[slug]/members/[userId]/route';
import { GET as postsGET } from '../src/app/api/communities/[slug]/posts/route';
import { GET as chatGET } from '../src/app/api/communities/[slug]/chat/route';
import { GET as invitesGET, POST as invitesPOST } from '../src/app/api/communities/[slug]/invitations/route';
import { DELETE as inviteDELETE } from '../src/app/api/communities/[slug]/invitations/[invitationId]/route';
import { POST as rotatePOST } from '../src/app/api/communities/[slug]/invitations/[invitationId]/rotate/route';
import { GET as previewGET } from '../src/app/api/invite/[id]/route';
import { POST as redeemPOST } from '../src/app/api/invite/[id]/join/route';
import { GET as reviewsGET, POST as reviewsPOST } from '../src/app/api/reviews/route';

after(async () => {
  await prisma.$disconnect();
});

const slugP = (slug: string) => ({ params: { slug } });
const creator = async () => {
  const u = await createUser();
  const r = await read(await upgradePOST(request('POST', '/api/creator/upgrade', { as: u, body: { channelName: 'Night Shift Anime', channelUrl: 'https://youtube.com/@nightshift' } })));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return u;
};
const makePrivate = async (owner: any, name = `Members ${Date.now()}${Math.random()}`) => {
  const r = await read(
    await communitiesPOST(request('POST', '/api/communities', { as: owner, body: { name, description: 'Channel members only — welcome in.', visibility: 'PRIVATE' } }))
  );
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body as { community: any; invitation: { id: string; key: string; path: string } };
};
const redeem = (as: any, id: string, key: string) => redeemPOST(request('POST', `/api/invite/${id}/join`, { as, body: { key } }), { params: { id } }).then(read);
const members = (as: any, slug: string) => membersGET(request('GET', `/api/communities/${slug}/members`, { as }), slugP(slug));

describe('creator role', () => {
  test('a member becomes a creator only through the upgrade step; role in the body is ignored', async () => {
    const u = await createUser();
    const bad = await read(await upgradePOST(request('POST', '/api/creator/upgrade', { as: u, body: { channelName: 'x', role: 'ADMIN' } })));
    assert.equal(bad.status, 400);
    assert.equal((await prisma.user.findUnique({ where: { id: u.id } }))!.role, 'USER');

    const ok = await read(await upgradePOST(request('POST', '/api/creator/upgrade', { as: u, body: { channelName: 'Studio Lofi', role: 'SUPER_ADMIN' } })));
    assert.equal(ok.status, 200);
    assert.equal(ok.body.isCreator, true);
    const row = await prisma.user.findUnique({ where: { id: u.id } });
    assert.equal(row!.role, 'CREATOR', 'never SUPER_ADMIN from the body');
    assert.ok(row!.creatorSince);

    assert.equal((await upgradePOST(request('POST', '/api/creator/upgrade', { body: { channelName: 'Anon' } }))).status, 401);
    const mod = await createUser('MODERATOR');
    assert.equal((await upgradePOST(request('POST', '/api/creator/upgrade', { as: mod, body: { channelName: 'Mod channel' } }))).status, 409);
  });

  test('normal users get no creator tools, whatever they send', async () => {
    const u = await createUser();
    const priv = await communitiesPOST(request('POST', '/api/communities', { as: u, body: { name: 'Sneaky club', description: 'Trying to be private here', visibility: 'PRIVATE' } }));
    assert.equal(priv.status, 403);
    const type = await communitiesPOST(request('POST', '/api/communities', { as: u, body: { name: 'Sneaky club 2', description: 'Trying a creator type here', communityType: 'CREATOR_EXCLUSIVE' } }));
    assert.equal(type.status, 403);
    // A normal public community still works, and joinPolicy from the client is ignored.
    const pub = await read(await communitiesPOST(request('POST', '/api/communities', { as: u, body: { name: `Open club ${Date.now()}`, description: 'Anyone welcome here', joinPolicy: 'INVITE_ONLY' } })));
    assert.equal(pub.status, 201);
    assert.equal(pub.body.community.visibility, 'PUBLIC');
    assert.equal(pub.body.community.joinPolicy, 'OPEN');
    assert.equal(pub.body.invitation, null);
    const toPrivate = await communityPATCH(request('PATCH', `/api/communities/${pub.body.community.slug}`, { as: u, body: { visibility: 'PRIVATE' } }), slugP(pub.body.community.slug));
    assert.equal(toPrivate.status, 403);

    assert.equal((await dashboardGET(request('GET', '/api/creator/dashboard', { as: u }))).status, 403);
    assert.equal((await myReviewsGET(request('GET', '/api/creator/reviews', { as: u }))).status, 403);
  });

  test('creators keep the normal experience', async () => {
    const c = await creator();
    assert.equal((await communitiesGET(request('GET', '/api/communities', { as: c }))).status, 200);
    const anime = await createAnime({ status: 'Finished Airing', episodes: 12 });
    assert.equal((await reviewsGET(request('GET', `/api/reviews?animeId=${anime.slug}`, { as: c }))).status, 200);
  });
});

describe('members-only communities', () => {
  test('creating one returns a link + key once; only a hash is stored', async () => {
    const c = await creator();
    const { community, invitation } = await makePrivate(c);
    assert.equal(community.visibility, 'PRIVATE');
    assert.equal(community.joinPolicy, 'INVITE_ONLY');
    assert.equal(community.ownerId, c.id);
    assert.match(invitation.path, new RegExp(`^/community/invite/${invitation.id}$`));
    assert.match(invitation.key, /^[0-9A-Z]{4}(-[0-9A-Z]{4}){5}$/);
    const row = await prisma.communityInvite.findUnique({ where: { id: invitation.id } });
    assert.equal(row!.keyHash, hashAccessKey(invitation.key));
    assert.notEqual(row!.token, invitation.key);
    assert.ok(!JSON.stringify(row).includes(invitation.key), 'plaintext key never stored');
    const listed = await read(await invitesGET(request('GET', `/api/communities/${community.slug}/invitations`, { as: c }), slugP(community.slug)));
    assert.ok(!JSON.stringify(listed.body).includes(invitation.key), 'never returned again');
    assert.equal(listed.body.invitations[0].keyHint, invitation.key.slice(-4));
  });

  test('outsiders see no content and cannot join by URL', async () => {
    const c = await creator();
    const { community, invitation } = await makePrivate(c);
    const stranger = await createUser();
    const detail = await read(await communityGET(request('GET', `/api/communities/${community.slug}`, { as: stranger }), slugP(community.slug)));
    assert.equal(detail.body.isRestricted ?? detail.body.community?.isRestricted, true);
    assert.equal((await members(stranger, community.slug)).status, 403);
    assert.equal((await postsGET(request('GET', `/api/communities/${community.slug}/posts`, { as: stranger }), slugP(community.slug))).status, 403);
    assert.notEqual((await chatGET(request('GET', `/api/communities/${community.slug}/chat`, { as: stranger }), slugP(community.slug))).status, 200);
    assert.equal((await members(undefined, community.slug)).status, 403, 'signed out too');
    // Direct join, with or without a made-up "verification" token, is refused.
    assert.equal((await joinPOST(request('POST', `/api/communities/${community.slug}/join`, { as: stranger }), slugP(community.slug))).status, 403);
    const forged = await joinPOST(
      request('POST', `/api/communities/${community.slug}/join`, { as: stranger, body: { verificationData: { provider: 'YOUTUBE', token: 'anything' } } }),
      slugP(community.slug)
    );
    assert.equal(forged.status, 403);
    // The invitation preview shows the name only — no description, members or posts.
    const preview = await read(await previewGET(request('GET', invitation.path), { params: { id: invitation.id } }));
    assert.deepEqual(Object.keys(preview.body.community).sort(), ['iconUrl', 'name']);
    // Not in discovery for outsiders.
    const list = await read(await communitiesGET(request('GET', '/api/communities', { as: stranger })));
    assert.ok(!JSON.stringify(list.body).includes(community.slug));
  });

  test('regression: a PRIVATE community with an OPEN policy can no longer be joined by slug', async () => {
    const owner = await createUser();
    const legacy = await createCommunityFixture(owner, 'PRIVATE', 'OPEN');
    const stranger = await createUser();
    assert.equal((await joinPOST(request('POST', `/api/communities/${legacy.slug}/join`, { as: stranger }), slugP(legacy.slug))).status, 403);
    assert.equal(await prisma.communityMember.count({ where: { communityId: legacy.id, userId: stranger.id } }), 0);
  });

  test('link + right key lets a signed-in member in, once; wrong key and signed-out are refused', async () => {
    const c = await creator();
    const { community, invitation } = await makePrivate(c);
    const fan = await createUser();
    assert.equal((await redeemPOST(request('POST', `/api/invite/${invitation.id}/join`, { body: { key: invitation.key } }), { params: { id: invitation.id } })).status, 401);
    const wrong = await redeem(fan, invitation.id, 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF');
    assert.equal(wrong.status, 403);
    assert.equal(wrong.body.code, 'WRONG_KEY');
    assert.equal((await members(fan, community.slug)).status, 403);

    const ok = await redeem(fan, invitation.id, invitation.key.toLowerCase().replace(/-/g, ' '));
    assert.equal(ok.status, 201, 'case and separators are forgiven');
    assert.equal(ok.body.slug, community.slug);
    assert.equal((await members(fan, community.slug)).status, 200);
    const again = await redeem(fan, invitation.id, invitation.key);
    assert.equal(again.status, 200);
    assert.equal(again.body.alreadyMember, true);
    assert.equal(await prisma.communityMember.count({ where: { communityId: community.id, userId: fan.id } }), 1);
    assert.equal((await prisma.communityInvite.findUnique({ where: { id: invitation.id } }))!.uses, 1);
  });

  test('rotation kills the old key; revoking stops new joins but keeps members', async () => {
    const c = await creator();
    const { community, invitation } = await makePrivate(c);
    const early = await createUser();
    assert.equal((await redeem(early, invitation.id, invitation.key)).status, 201);

    const rotated = await read(await rotatePOST(request('POST', '/x', { as: c }), { params: { slug: community.slug, invitationId: invitation.id } }));
    assert.equal(rotated.status, 200);
    const late = await createUser();
    assert.equal((await redeem(late, invitation.id, invitation.key)).status, 403, 'old key dead');
    assert.equal((await redeem(late, invitation.id, rotated.body.key)).status, 201, 'same link, new key');

    assert.equal((await inviteDELETE(request('DELETE', '/x', { as: c }), { params: { slug: community.slug, invitationId: invitation.id } })).status, 200);
    const third = await createUser();
    const refused = await redeem(third, invitation.id, rotated.body.key);
    assert.equal(refused.status, 410);
    assert.equal((await members(early, community.slug)).status, 200, 'existing members keep access');
    const preview = await read(await previewGET(request('GET', '/x'), { params: { id: invitation.id } }));
    assert.equal(preview.body.status, 'INACTIVE');
  });

  test('expired invitations and use limits hold, even under concurrent joins', async () => {
    const c = await creator();
    const { community, invitation } = await makePrivate(c);
    await prisma.communityInvite.update({ where: { id: invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await redeem(await createUser(), invitation.id, invitation.key)).status, 410);

    const limited = await read(await invitesPOST(request('POST', '/x', { as: c, body: { maxUses: 2 } }), slugP(community.slug)));
    assert.equal(limited.status, 201);
    const fans = await Promise.all(Array.from({ length: 5 }, () => createUser()));
    const results = await Promise.all(fans.map((f) => redeem(f, limited.body.invitation.id, limited.body.key)));
    assert.equal(results.filter((r) => r.status === 201).length, 2, JSON.stringify(results.map((r) => r.status)));
    assert.equal((await prisma.communityInvite.findUnique({ where: { id: limited.body.invitation.id } }))!.uses, 2);
  });

  test('only the owner manages invitations; members can be removed explicitly', async () => {
    const c = await creator();
    const { community, invitation } = await makePrivate(c);
    const member = await createUser();
    await redeem(member, invitation.id, invitation.key);
    const otherCreator = await creator();
    assert.equal((await invitesGET(request('GET', '/x', { as: member }), slugP(community.slug))).status, 404);
    assert.equal((await invitesGET(request('GET', '/x', { as: otherCreator }), slugP(community.slug))).status, 404);
    assert.equal((await rotatePOST(request('POST', '/x', { as: otherCreator }), { params: { slug: community.slug, invitationId: invitation.id } })).status, 404);
    assert.equal((await communityPATCH(request('PATCH', '/x', { as: member, body: { visibility: 'PUBLIC' } }), slugP(community.slug))).status, 403);

    assert.equal((await memberDELETE(request('DELETE', '/x', { as: member }), { params: { slug: community.slug, userId: c.id } })).status, 403);
    assert.equal((await memberDELETE(request('DELETE', '/x', { as: c }), { params: { slug: community.slug, userId: member.id } })).status, 200);
    assert.equal((await members(member, community.slug)).status, 403, 'removed member loses access');
  });

  test('brute force is rate limited', async () => {
    const c = await creator();
    const { invitation } = await makePrivate(c);
    const attacker = await createUser();
    const statuses: number[] = [];
    for (let i = 0; i < 9; i++) statuses.push((await redeem(attacker, invitation.id, `WRONG-${i}`)).status);
    assert.equal(statuses[8], 429, JSON.stringify(statuses));
  });

  test('the dashboard counts real communities, members and reviews', async () => {
    const c = await creator();
    const { invitation } = await makePrivate(c);
    await redeem(await createUser(), invitation.id, invitation.key);
    const d = await read(await dashboardGET(request('GET', '/api/creator/dashboard', { as: c })));
    assert.equal(d.status, 200);
    assert.equal(d.body.stats.communities, 1);
    assert.equal(d.body.stats.members, 2, 'owner + one member');
    assert.equal(d.body.communities[0].membersOnly, true);
    assert.equal(d.body.communities[0].activeInvitations, 1);
    assert.ok(d.body.activity.some((a: any) => a.kind === 'JOIN'));
  });
});

describe('creator reviews', () => {
  const save = (as: any, body: any) => creatorReviewPOST(request('POST', '/api/creator/reviews', { as, body })).then(read);
  const publicList = (slug: string, extra = '') => reviewsGET(request('GET', `/api/reviews?animeId=${slug}${extra}`)).then(read);
  const BODY = 'A careful look at the pacing, the direction and why the finale works as well as it does.';

  test('drafts stay private; publishing shows the Creator Review label on the anime page', async () => {
    const c = await creator();
    const anime = await createAnime({ status: 'Finished Airing', episodes: 12 });
    const draft = await save(c, { animeId: anime.slug, title: 'First impressions', body: BODY, publish: false });
    assert.equal(draft.status, 201, JSON.stringify(draft.body));
    assert.equal(draft.body.review.status, 'DRAFT');
    assert.equal((await publicList(anime.slug)).body.reviews.length, 0, 'draft not public');
    const viewerOwn = await read(await reviewsGET(request('GET', `/api/reviews?animeId=${anime.slug}`, { as: c })));
    assert.equal(viewerOwn.body.userReview, null, 'draft not shown as your review either');
    const mine = await read(await myReviewsGET(request('GET', '/api/creator/reviews', { as: c })));
    assert.equal(mine.body.reviews.length, 1);

    const pub = await read(
      await creatorReviewPATCH(
        request('PATCH', '/x', { as: c, body: { title: 'Final verdict', body: BODY, score: 9.1, spoilerLevel: 'MILD_SPOILERS', publish: true } }),
        { params: { id: draft.body.review.id } }
      )
    );
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    assert.equal(pub.body.review.status, 'PUBLISHED');
    assert.equal(pub.body.review.score, 9.1);

    const list = await publicList(anime.slug);
    assert.equal(list.body.reviews.length, 1);
    const r = list.body.reviews[0];
    assert.equal(r.isCreatorReview, true);
    assert.equal(r.title, 'Final verdict');
    assert.equal(r.spoilerLevel, 'MILD_SPOILERS');
    assert.equal(r.rating, 9.1, 'the score is the creator’s real rating');
    assert.equal((await publicList(anime.slug, '&creators=1')).body.reviews.length, 1);
  });

  test('normal users cannot publish creator reviews or claim the label', async () => {
    const u = await createUser();
    const anime = await createAnime({ status: 'Finished Airing', episodes: 12 });
    assert.equal((await save(u, { animeId: anime.slug, title: 'Not a creator', body: BODY, publish: true })).status, 403);
    const normal = await read(
      await reviewsPOST(request('POST', '/api/reviews', { as: u, body: { animeId: anime.id, body: BODY, isCreatorReview: true } }))
    );
    assert.equal(normal.status, 200, JSON.stringify(normal.body));
    const row = await prisma.review.findFirst({ where: { userId: u.id, animeId: anime.id } });
    assert.equal(row!.isCreatorReview, false);
    assert.equal((await publicList(anime.slug, '&creators=1')).body.reviews.length, 0);
  });

  test("a creator can't edit another creator's review; nothing publishes before episode 1", async () => {
    const a = await creator();
    const b = await creator();
    const anime = await createAnime({ status: 'Finished Airing', episodes: 12 });
    const pub = await save(a, { animeId: anime.slug, title: 'Mine', body: BODY, publish: true });
    assert.equal(pub.status, 201);
    const hijack = await creatorReviewPATCH(request('PATCH', '/x', { as: b, body: { title: 'Hijacked', body: BODY, publish: true } }), { params: { id: pub.body.review.id } });
    assert.equal(hijack.status, 404);
    assert.equal((await prisma.review.findUnique({ where: { id: pub.body.review.id } }))!.title, 'Mine');

    const upcoming = await createAnime({ status: 'Not yet aired', episodes: 12 });
    assert.equal((await save(a, { animeId: upcoming.slug, title: 'Too early', body: BODY, publish: true })).status, 403);
    assert.equal((await save(a, { animeId: upcoming.slug, title: 'Too early', body: BODY, publish: false })).status, 201, 'drafts are fine');
  });
});
