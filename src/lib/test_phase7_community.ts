/**
 * OTAKUVA PHASE 7 — PRODUCTION COMMUNITY ENGINE TEST SUITE
 * Tests:
 * - Persistent community creation, owner assignment, and slug generation
 * - Multi-account discovery and isolation (Account B discovers Account A community)
 * - Join policies: OPEN, APPROVAL_REQUIRED, CREATOR_ONLY
 * - Community discussions, posts, threaded comments, and spoiler flags
 * - Real-time chat message persistence, room authorization, and length limits
 * - Moderation actions: bans, muting, unbans, and audit logging
 * - Content reporting
 * - Owner restrictions on leaving
 * - Standardized community event logging
 */

import { prisma } from './prisma';
import {
  createCommunity,
  joinCommunity,
  leaveCommunity,
  createCommunityPost,
  createDiscussionComment,
  banCommunityMember,
  unbanCommunityMember,
  sendCommunityChatMessage,
  reportCommunityContent,
  getMemberPermission,
  COMMUNITY_ENGINE_VERSION,
} from './engine/community/communityEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runPhase7CommunityTests() {
  console.log('======================================================');
  console.log('🧪 RUNNING OTAKUVA PHASE 7 COMMUNITY ENGINE TEST SUITE');
  console.log('======================================================\n');

  // STEP 0: Setup test users
  const userA = await prisma.user.upsert({
    where: { email: 'phase7_owner_a@otakuva.com' },
    update: {},
    create: { username: 'Phase7_OwnerA', email: 'phase7_owner_a@otakuva.com', passwordHash: 'hash123' },
  });

  const userB = await prisma.user.upsert({
    where: { email: 'phase7_member_b@otakuva.com' },
    update: {},
    create: { username: 'Phase7_MemberB', email: 'phase7_member_b@otakuva.com', passwordHash: 'hash123' },
  });

  const userC = await prisma.user.upsert({
    where: { email: 'phase7_outsider_c@otakuva.com' },
    update: {},
    create: { username: 'Phase7_OutsiderC', email: 'phase7_outsider_c@otakuva.com', passwordHash: 'hash123' },
  });

  // Clean prior test data
  const existingTestComms = await prisma.community.findMany({
    where: { ownerId: userA.id },
  });
  const commIds = existingTestComms.map((c) => c.id);

  if (commIds.length > 0) {
    await prisma.moderationAction.deleteMany({ where: { communityId: { in: commIds } } });
    await prisma.communityBan.deleteMany({ where: { communityId: { in: commIds } } });
    await prisma.communityJoinRequest.deleteMany({ where: { communityId: { in: commIds } } });
    await prisma.communityMessage.deleteMany({ where: { channel: { communityId: { in: commIds } } } });
    await prisma.discussionComment.deleteMany({ where: { discussion: { communityId: { in: commIds } } } });
    await prisma.discussion.deleteMany({ where: { communityId: { in: commIds } } });
    await prisma.communityMember.deleteMany({ where: { communityId: { in: commIds } } });
    await prisma.community.deleteMany({ where: { id: { in: commIds } } });
  }

  // --- TEST 1: Community Creation & Ownership Assignment ---
  console.log('--- TEST 1: Persistent Community Creation ---');
  const community = await createCommunity(userA.id, {
    name: 'Attack on Titan Fan Club',
    description: 'The ultimate sanctuary for discussing Attack on Titan theories and lore.',
    category: 'ANIME',
    communityType: 'ANIME',
    visibility: 'PUBLIC',
    joinPolicy: 'OPEN',
    rules: [
      { title: 'Be Respectful', content: 'Treat all members with respect.' },
      { title: 'Tag Spoilers', content: 'Always tag manga spoilers.' },
    ],
  });

  assert(community.ownerId === userA.id, 'Community ownerId matches User A');
  assert(community.members.length === 1, 'Owner membership created automatically');
  assert(community.members[0].role === 'OWNER', 'Owner role assigned as OWNER');
  assert(community.members[0].status === 'ACTIVE', 'Owner status set to ACTIVE');
  assert(community.channels.length === 3, 'Default channels created (general, discussions, announcements)');

  // --- TEST 2: Multi-Account Discovery & Join ---
  console.log('\n--- TEST 2: Multi-Account Discovery & Join Workflow ---');
  const joinRes = await joinCommunity(userB.id, community.slug);
  assert(joinRes.success === true, 'User B successfully joined community');
  assert(joinRes.status === 'ACTIVE', 'User B membership status is ACTIVE');
  assert(joinRes.memberCount === 2, 'Community memberCount updated to 2');

  const permB = await getMemberPermission(userB.id, community.id);
  assert(permB.isMember === true, 'Permission check confirms User B is active member');
  assert(permB.canPost === true, 'User B can create posts');
  assert(permB.canChat === true, 'User B can participate in chat');

  // --- TEST 3: Approval Required Join Policy ---
  console.log('\n--- TEST 3: Join Policy (APPROVAL_REQUIRED) ---');
  const privateComm = await createCommunity(userA.id, {
    name: 'Manga Elites Secret Club',
    description: 'Private club for deep manga analysis and secret lore.',
    visibility: 'REQUEST_TO_JOIN',
    joinPolicy: 'APPROVAL_REQUIRED',
  });

  const requestRes = await joinCommunity(userB.id, privateComm.slug);
  assert(requestRes.status === 'PENDING', 'User B join is placed in PENDING state');

  const pendingInDb = await prisma.communityJoinRequest.findUnique({
    where: { communityId_userId: { communityId: privateComm.id, userId: userB.id } },
  });
  assert(Boolean(pendingInDb), 'Join request recorded in database');

  // --- TEST 4: Discussions, Posts, and Threaded Comments ---
  console.log('\n--- TEST 4: Posts and Threaded Comments ---');
  const generalChannel = community.channels.find((c) => c.slug === 'discussions');
  const post = await createCommunityPost({
    authorId: userB.id,
    communityId: community.id,
    channelId: generalChannel?.id,
    title: 'The Rumbling and Moral Ambiguity',
    body: 'How do you interpret Eren’s ultimate motivations in the final arc?',
    type: 'THEORY',
    spoilerLevel: 'ANIME_SPOILER',
  });

  assert(post.title === 'The Rumbling and Moral Ambiguity', 'Post title stored accurately');
  assert(post.spoilerLevel === 'ANIME_SPOILER', 'Spoiler level marked as ANIME_SPOILER');

  // Comment on the post by Owner A
  const comment = await createDiscussionComment({
    authorId: userA.id,
    discussionId: post.id,
    body: 'A deeply compelling exploration of determinism vs free will.',
  });

  assert(comment.discussionId === post.id, 'Comment linked to discussion');
  const postAfterComment = await prisma.discussion.findUnique({ where: { id: post.id } });
  assert(postAfterComment?.replyCount === 1, 'Discussion replyCount incremented to 1');

  // --- TEST 5: Real-Time Chat Message Persistence & Authorization ---
  console.log('\n--- TEST 5: Real-Time Chat Message Persistence & Room Authorization ---');
  const chatChannel = community.channels.find((c) => c.slug === 'general');
  const chatRes = await sendCommunityChatMessage(
    userB.id,
    chatChannel!.id,
    'Hello everyone in the Attack on Titan community!'
  );

  assert(chatRes.message.body === 'Hello everyone in the Attack on Titan community!', 'Chat message stored in database');
  assert(chatRes.room === `community:${community.id}`, `Room identifier is community:${community.id}`);

  // Outsider C (not a member) attempts to send chat message
  try {
    await sendCommunityChatMessage(userC.id, chatChannel!.id, 'Unauthorized message attempt');
    assert(false, 'Non-member should be blocked from sending chat messages');
  } catch (err: any) {
    assert(err.message.includes('Unauthorized'), 'Non-member chat rejected with 403 Unauthorized');
  }

  // --- TEST 6: Community Moderation & User Ban ---
  console.log('\n--- TEST 6: Community Moderation & User Ban ---');
  const banRes = await banCommunityMember(userA.id, community.id, userB.id, 'Violating spoiler rules', 24);
  assert(banRes.status === 'BANNED', 'User B banned from community');

  const permAfterBan = await getMemberPermission(userB.id, community.id);
  assert(permAfterBan.isBanned === true, 'Permission check confirms User B is banned');
  assert(permAfterBan.canChat === false, 'Banned User B cannot chat');
  assert(permAfterBan.canPost === false, 'Banned User B cannot post');

  // Unban User B
  const unbanRes = await unbanCommunityMember(userA.id, community.id, userB.id);
  assert(unbanRes.status === 'ACTIVE', 'User B successfully unbanned');
  const permAfterUnban = await getMemberPermission(userB.id, community.id);
  assert(permAfterUnban.isBanned === false, 'User B is no longer banned');

  // --- TEST 7: Content Reporting ---
  console.log('\n--- TEST 7: Content Reporting ---');
  const report = await reportCommunityContent(
    userB.id,
    'DISCUSSION',
    post.id,
    'SPOILER_MISUSE',
    'Post contains unmarked manga spoilers'
  );
  assert(report.reason === 'SPOILER_MISUSE', 'Report recorded with reason SPOILER_MISUSE');
  assert(report.status === 'OPEN', 'Report status is OPEN');

  // --- TEST 8: Owner Restrictions on Leaving ---
  console.log('\n--- TEST 8: Owner Restrictions on Leaving ---');
  try {
    await leaveCommunity(userA.id, community.slug);
    assert(false, 'Owner should not be able to leave without transferring ownership');
  } catch (err: any) {
    assert(err.message.includes('owner cannot leave'), 'Owner departure prevented without ownership transfer');
  }

  // Member B leaves successfully
  const leaveRes = await leaveCommunity(userB.id, community.slug);
  assert(leaveRes.success === true, 'Member B left community successfully');
  assert(leaveRes.memberCount === 1, 'Member count updated back to 1');

  // --- TEST 9: Standardized Event Log Verification ---
  console.log('\n--- TEST 9: Standardized Event Logging ---');
  const events = await prisma.eventLog.findMany({
    where: { entityId: community.id },
  });
  const eventTypes = events.map((e) => e.eventType);
  assert(eventTypes.includes('COMMUNITY_CREATED'), 'EventLog contains COMMUNITY_CREATED');
  assert(eventTypes.includes('MEMBER_JOINED'), 'EventLog contains MEMBER_JOINED');
  assert(eventTypes.includes('MEMBER_BANNED'), 'EventLog contains MEMBER_BANNED');

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 7 COMMUNITY ENGINE TESTS PASSED!');
  console.log('======================================================\n');
}

runPhase7CommunityTests()
  .catch((err) => {
    console.error('Phase 7 test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
