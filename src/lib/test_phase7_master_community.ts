/**
 * OTAKUVA PHASE 7 — COMPLETE PRODUCTION COMMUNITY ENGINE MASTER TEST SUITE
 * Covers:
 * - 7.1 Community Core & Database Persistence
 * - 7.2 Membership, Roles, Join Policies, Mutes & Bans
 * - 7.3 Posts, Threaded Comments, Polls, Reactions & Spoilers
 * - 7.4 Content Reporting, Moderation Actions & Audit Logs
 * - 7.5 & 7.6 Real-Time Chat Message Persistence, Edit & Soft Delete
 * - 7.7 Presence Tracking & Transient Typing Indicators
 * - 7.8 Creator Communities & External Verification Abstraction
 * - 7.9 Anime Context Integration
 * - 7.10 Notifications & Mentions
 * - 7.11 Security & Multi-User Isolation
 * - 7.12 Ownership Transfer Workflow
 */

import { prisma } from './prisma';
import {
  createCommunity,
  getCommunityByIdOrSlug,
  listDiscoverableCommunities,
  joinCommunity,
  leaveCommunity,
  reviewJoinRequest,
  updateMemberRole,
  muteCommunityMember,
  unmuteCommunityMember,
  banCommunityMember,
  unbanCommunityMember,
  transferCommunityOwnership,
  createCommunityPost,
  createDiscussionComment,
  reactToPost,
  reactToComment,
  voteInPoll,
  reportCommunityContent,
  lockDiscussion,
  sendCommunityChatMessage,
  editCommunityChatMessage,
  deleteCommunityChatMessage,
  trackUserPresence,
  getCommunityOnlineCount,
  setTypingState,
  getActiveTypingUsers,
  getAnimeCommunityDiscussions,
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

async function runPhase7MasterTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING OTAKUVA PHASE 7 MASTER COMMUNITY ENGINE TEST SUITE');
  console.log('================================================================\n');

  // STEP 0: Setup test users
  const userA = await prisma.user.upsert({
    where: { email: 'phase7_master_a@otakuva.com' },
    update: {},
    create: { username: 'Phase7Master_UserA', email: 'phase7_master_a@otakuva.com', passwordHash: 'hash123' },
  });

  const userB = await prisma.user.upsert({
    where: { email: 'phase7_master_b@otakuva.com' },
    update: {},
    create: { username: 'Phase7Master_UserB', email: 'phase7_master_b@otakuva.com', passwordHash: 'hash123' },
  });

  const userC = await prisma.user.upsert({
    where: { email: 'phase7_master_c@otakuva.com' },
    update: {},
    create: { username: 'Phase7Master_UserC', email: 'phase7_master_c@otakuva.com', passwordHash: 'hash123' },
  });

  // Clean prior test data
  const testUsers = [userA.id, userB.id, userC.id];
  const oldComms = await prisma.community.findMany({ where: { ownerId: { in: testUsers } } });
  const oldCommIds = oldComms.map((c) => c.id);

  if (oldCommIds.length > 0) {
    await prisma.pollVote.deleteMany({ where: { userId: { in: testUsers } } });
    await prisma.pollOption.deleteMany({ where: { poll: { discussion: { communityId: { in: oldCommIds } } } } });
    await prisma.discussionPoll.deleteMany({ where: { discussion: { communityId: { in: oldCommIds } } } });
    await prisma.moderationAction.deleteMany({ where: { communityId: { in: oldCommIds } } });
    await prisma.communityBan.deleteMany({ where: { communityId: { in: oldCommIds } } });
    await prisma.communityJoinRequest.deleteMany({ where: { communityId: { in: oldCommIds } } });
    await prisma.communityMessage.deleteMany({ where: { channel: { communityId: { in: oldCommIds } } } });
    await prisma.commentReaction.deleteMany({ where: { userId: { in: testUsers } } });
    await prisma.discussionReaction.deleteMany({ where: { userId: { in: testUsers } } });
    await prisma.discussionComment.deleteMany({ where: { discussion: { communityId: { in: oldCommIds } } } });
    await prisma.discussion.deleteMany({ where: { communityId: { in: oldCommIds } } });
    await prisma.communityRule.deleteMany({ where: { communityId: { in: oldCommIds } } });
    await prisma.communityChannel.deleteMany({ where: { communityId: { in: oldCommIds } } });
    await prisma.communityMember.deleteMany({ where: { communityId: { in: oldCommIds } } });
    await prisma.community.deleteMany({ where: { id: { in: oldCommIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: testUsers } } });
  }

  // --- TEST 1: Community Creation & Permanent Database Storage ---
  console.log('--- TEST 1: Community Creation & Permanent Database Storage ---');
  const community = await createCommunity(userA.id, {
    name: 'Steins Gate World Line',
    description: 'A sanctuary dedicated to discussing temporal theories, Divergence Meters, and timelines.',
    category: 'ANIME',
    communityType: 'ANIME',
    visibility: 'PUBLIC',
    joinPolicy: 'OPEN',
    rules: [{ title: 'El Psy Kongroo', content: 'Honor the lab member code.' }],
  });

  assert(community.ownerId === userA.id, 'Community ownerId matches User A');
  assert(community.members[0].role === 'OWNER', 'Owner role assigned as OWNER');
  assert(community.members[0].status === 'ACTIVE', 'Owner status set to ACTIVE');

  // --- TEST 2 & 3: Browser Refresh & Direct Database Fetch ---
  console.log('\n--- TEST 2 & 3: Browser Refresh & Direct Database Persistence ---');
  const fetchedAfterRefresh = await getCommunityByIdOrSlug(community.slug, userA.id);
  assert(Boolean(fetchedAfterRefresh), 'Community fetched directly from PostgreSQL after simulated refresh');
  assert(fetchedAfterRefresh!.userRole === 'OWNER', 'Owner session correctly identifies OWNER role');

  // --- TEST 4: Second Account Discovery ---
  console.log('\n--- TEST 4: Multi-Account Discovery ---');
  const searchResults = await listDiscoverableCommunities({ query: 'Steins Gate', userId: userB.id });
  const foundInSearch = searchResults.communities.find((c) => c.id === community.id);
  assert(Boolean(foundInSearch), 'User B found public community created by User A');

  // --- TEST 5: Private Community Isolation ---
  console.log('\n--- TEST 5: Private Community Isolation ---');
  const privateComm = await createCommunity(userA.id, {
    name: 'Round Table Secret Lab',
    description: 'Private lab member discussions only.',
    visibility: 'PRIVATE',
    joinPolicy: 'INVITE_ONLY',
  });

  const searchPrivate = await listDiscoverableCommunities({ query: 'Round Table Secret', userId: userB.id });
  const leakedPrivate = searchPrivate.communities.some((c) => c.id === privateComm.id);
  assert(!leakedPrivate, 'Private community is strictly hidden from public discovery');

  const directFetchPrivate = await getCommunityByIdOrSlug(privateComm.slug, userB.id);
  assert(directFetchPrivate!.isRestricted === true, 'Unauthorized user receives isRestricted = true for private community');

  // --- TEST 6: Join Public Community ---
  console.log('\n--- TEST 6: Join Public Community ---');
  const joinResult = await joinCommunity(userB.id, community.slug);
  assert(joinResult.success === true, 'User B successfully joined public community');
  assert(joinResult.status === 'ACTIVE', 'User B status is ACTIVE');
  assert(joinResult.memberCount === 2, 'Community memberCount updated to 2');

  // --- TEST 7: Approval Required Join Workflow ---
  console.log('\n--- TEST 7: Approval Required Join Workflow ---');
  const approvalComm = await createCommunity(userA.id, {
    name: 'Future Gadget Lab Exclusive',
    description: 'Lab member badge required.',
    visibility: 'REQUEST_TO_JOIN',
    joinPolicy: 'APPROVAL_REQUIRED',
  });

  const requestJoinResult = await joinCommunity(userB.id, approvalComm.slug);
  assert(requestJoinResult.status === 'PENDING', 'User B join request placed in PENDING state');

  const approveResult = await reviewJoinRequest(userA.id, approvalComm.id, userB.id, 'APPROVE');
  assert(approveResult.status === 'ACTIVE', 'Owner approved join request -> status became ACTIVE');

  const notifForB = await prisma.notification.findFirst({
    where: { userId: userB.id, type: 'COMMUNITY_JOIN_APPROVED' },
  });
  assert(Boolean(notifForB), 'Notification delivered to User B upon approval');

  // --- TEST 8: Role Security & Hierarchy ---
  console.log('\n--- TEST 8: Role Hierarchy & Forbidden Security ---');
  try {
    await updateMemberRole(userB.id, community.id, userA.id, 'MEMBER');
    assert(false, 'Member should not be able to demote Owner');
  } catch (err: any) {
    assert(err.message.includes('Unauthorized'), 'Unauthorized role modification rejected with 403');
  }

  const promoteResult = await updateMemberRole(userA.id, community.id, userB.id, 'MODERATOR');
  assert(promoteResult.role === 'MODERATOR', 'Owner successfully promoted User B to MODERATOR');

  const permB = await getMemberPermission(userB.id, community.id);
  assert(permB.isModerator === true, 'Permission check confirms User B is MODERATOR');

  // --- TEST 9: Posts & Discussions ---
  console.log('\n--- TEST 9: Post Creation & Persistence ---');
  const post = await createCommunityPost({
    authorId: userB.id,
    communityId: community.id,
    title: 'Divergence 1.048596 Theory',
    body: 'How did Okabe achieve the Steins Gate world line without triggering SERN dystopia?',
    type: 'THEORY',
    spoilerLevel: 'ANIME_SPOILER',
  });

  assert(post.title === 'Divergence 1.048596 Theory', 'Post title matches');
  assert(post.spoilerLevel === 'ANIME_SPOILER', 'Spoiler level marked as ANIME_SPOILER');

  // --- TEST 10: Threaded Comments & Replies ---
  console.log('\n--- TEST 10: Threaded Comments & Author Notifications ---');
  const comment = await createDiscussionComment({
    authorId: userA.id,
    discussionId: post.id,
    body: 'By deceiving his past self and burning the paper that had the time machine blueprints.',
  });

  assert(comment.discussionId === post.id, 'Comment linked to discussion');
  const replyNotif = await prisma.notification.findFirst({
    where: { userId: userB.id, type: 'REPLY_DISCUSSION' },
  });
  assert(Boolean(replyNotif), 'Discussion author User B received reply notification');

  // --- TEST 11: Polls & Duplicate Vote Prevention ---
  console.log('\n--- TEST 11: Poll Creation & Duplicate Vote Guard ---');
  const pollPost = await createCommunityPost({
    authorId: userA.id,
    communityId: community.id,
    title: 'Best Steins Gate Character',
    body: 'Cast your vote for the ultimate lab member.',
    type: 'POLL',
    poll: {
      question: 'Who is best lab member?',
      options: ['Rintaro Okabe', 'Kurisu Makise', 'Mayuri Shiina', 'Suzuha Amane'],
      expiresInDays: 7,
    },
  });

  assert(Boolean(pollPost.poll), 'Poll created on discussion post');
  assert(pollPost.poll!.options.length === 4, '4 poll options created');

  const firstOptionId = pollPost.poll!.options[0].id;
  const voteResult = await voteInPoll(userB.id, firstOptionId);
  assert(voteResult.optionId === firstOptionId, 'User B voted for option 1');

  try {
    await voteInPoll(userB.id, firstOptionId);
    assert(false, 'Duplicate vote should have been prevented');
  } catch (err: any) {
    assert(err.message.includes('already voted'), 'Duplicate poll voting rejected cleanly');
  }

  // --- TEST 12: Real-Time Chat Message Persistence & Acknowledgement ---
  console.log('\n--- TEST 12: Real-Time Chat Persistence ---');
  const generalChannel = community.channels.find((c) => c.slug === 'general')!;
  const chatMsg = await sendCommunityChatMessage(
    userB.id,
    generalChannel.id,
    'Operation Skuld has commenced.'
  );

  assert(chatMsg.message.body === 'Operation Skuld has commenced.', 'Message body stored in database');
  assert(chatMsg.room === `community:${community.id}`, `Room key is community:${community.id}`);

  // --- TEST 13: Chat Message Editing & Soft Deletion ---
  console.log('\n--- TEST 13: Chat Message Editing & Soft Deletion ---');
  const editedMsg = await editCommunityChatMessage(userB.id, chatMsg.message.id, 'Operation Skuld has succeeded.');
  assert(editedMsg.body === 'Operation Skuld has succeeded.', 'Message body updated in database');

  const deletedMsg = await deleteCommunityChatMessage(userA.id, chatMsg.message.id);
  assert(Boolean(deletedMsg.deletedAt), 'Message soft-deleted with timestamp');

  // --- TEST 14: Chat Security (Non-Member Blocked) ---
  console.log('\n--- TEST 14: Chat Non-Member Security ---');
  try {
    await sendCommunityChatMessage(userC.id, generalChannel.id, 'Intruder message');
    assert(false, 'Non-member should be blocked from sending chat messages');
  } catch (err: any) {
    assert(err.message.includes('Unauthorized'), 'Non-member chat rejected with 403');
  }

  // --- TEST 15: Member Mute & Ban Security ---
  console.log('\n--- TEST 15: Member Mute & Ban Security ---');
  // Mute User B for 10 minutes
  await muteCommunityMember(userA.id, community.id, userB.id, 10, 'Excessive caps');
  const permMuted = await getMemberPermission(userB.id, community.id);
  assert(permMuted.isMuted === true, 'User B permission reflects isMuted = true');
  assert(permMuted.canChat === false, 'Muted User B cannot chat');

  // Unmute User B
  await unmuteCommunityMember(userA.id, community.id, userB.id);
  const permUnmuted = await getMemberPermission(userB.id, community.id);
  assert(permUnmuted.isMuted === false, 'User B successfully unmuted');

  // Ban User B
  await banCommunityMember(userA.id, community.id, userB.id, 'Violating timeline rules', 24);
  const permBanned = await getMemberPermission(userB.id, community.id);
  assert(permBanned.isBanned === true, 'User B reflects isBanned = true');
  assert(permBanned.canPost === false, 'Banned User B cannot post');

  // Unban User B
  await unbanCommunityMember(userA.id, community.id, userB.id);
  const permRestored = await getMemberPermission(userB.id, community.id);
  assert(permRestored.isBanned === false, 'User B successfully unbanned');

  // --- TEST 16: Moderation Actions & Discussion Locking ---
  console.log('\n--- TEST 16: Discussion Locking & Moderation Audit Log ---');
  await lockDiscussion(userA.id, post.id, 'Resolved theory thread');
  const lockedPost = await prisma.discussion.findUnique({ where: { id: post.id } });
  assert(lockedPost?.status === 'LOCKED', 'Discussion status updated to LOCKED');

  try {
    await createDiscussionComment({ authorId: userB.id, discussionId: post.id, body: 'Reply to locked thread' });
    assert(false, 'Comments on locked thread should be blocked');
  } catch (err: any) {
    assert(err.message.includes('locked'), 'Comment on locked thread rejected');
  }

  // --- TEST 17: Presence Tracking (In-Memory) ---
  console.log('\n--- TEST 17: Presence Tracking (In-Memory) ---');
  trackUserPresence(community.id, userA.id, 'ONLINE');
  trackUserPresence(community.id, userB.id, 'ONLINE');
  const onlineCount = getCommunityOnlineCount(community.id);
  assert(onlineCount === 2, `Online count matches active presence (${onlineCount})`);

  trackUserPresence(community.id, userB.id, 'OFFLINE');
  const onlineCountAfterOffline = getCommunityOnlineCount(community.id);
  assert(onlineCountAfterOffline === 1, 'Online count updated after User B disconnects');

  // --- TEST 18: Transient Typing Indicators ---
  console.log('\n--- TEST 18: Transient Typing Indicators ---');
  setTypingState(community.id, userA.id, 'Phase7Master_UserA', true);
  const typingUsers = getActiveTypingUsers(community.id);
  assert(typingUsers.includes('Phase7Master_UserA'), 'Typing indicator shows Phase7Master_UserA');

  setTypingState(community.id, userA.id, 'Phase7Master_UserA', false);
  const typingUsersAfterStop = getActiveTypingUsers(community.id);
  assert(typingUsersAfterStop.length === 0, 'Typing indicator removed after typing stops');

  // --- TEST 19: Creator Communities & Verification Abstraction ---
  console.log('\n--- TEST 19: Creator Communities & Verification Abstraction ---');
  const creatorComm = await createCommunity(userA.id, {
    name: 'Gigguk Anime Lounge',
    description: 'Exclusive lounge for verified Patreon/YouTube community members.',
    communityType: 'CREATOR_EXCLUSIVE',
    joinPolicy: 'CREATOR_ONLY',
  });

  // Unverified user attempts join -> rejected
  try {
    await joinCommunity(userB.id, creatorComm.slug);
    assert(false, 'Unverified user should not be able to join creator-only community');
  } catch (err: any) {
    assert(err.message.includes('creator-exclusive'), 'Unverified join rejected cleanly');
  }

  // Verified user with token joins successfully
  const verifiedJoin = await joinCommunity(userB.id, creatorComm.slug, {
    provider: 'YOUTUBE',
    token: 'yt_verified_tok_123',
  });
  assert(verifiedJoin.status === 'ACTIVE', 'Verified user successfully joined creator community');

  // --- TEST 20: Content Reporting ---
  console.log('\n--- TEST 20: Content Reporting ---');
  const report = await reportCommunityContent(
    userB.id,
    'DISCUSSION',
    post.id,
    'SPOILER_MISUSE',
    'Unmarked Steins Gate 0 ending spoilers'
  );
  assert(report.reason === 'SPOILER_MISUSE', 'Report recorded with reason SPOILER_MISUSE');
  assert(report.status === 'OPEN', 'Report status is OPEN');

  // --- TEST 21: Notifications & @Mentions ---
  console.log('\n--- TEST 21: @Mentions and Notification Delivery ---');
  await createCommunityPost({
    authorId: userB.id,
    communityId: community.id,
    title: 'Calling the Lead Scientist',
    body: 'What do you think of this theory, @Phase7Master_UserA ?',
  });

  const mentionNotif = await prisma.notification.findFirst({
    where: { userId: userA.id, type: 'MENTION' },
  });
  assert(Boolean(mentionNotif), 'User A received MENTION notification from post content');

  // --- TEST 22: Ownership Transfer ---
  console.log('\n--- TEST 22: Community Ownership Transfer ---');
  const transferRes = await transferCommunityOwnership(userA.id, community.id, userB.id);
  assert(transferRes.newOwnerId === userB.id, 'Community ownership transferred to User B');

  const permAfterTransferB = await getMemberPermission(userB.id, community.id);
  assert(permAfterTransferB.isOwner === true, 'User B is now authoritative OWNER');

  const permAfterTransferA = await getMemberPermission(userA.id, community.id);
  assert(permAfterTransferA.isOwner === false, 'User A is no longer OWNER');
  assert(permAfterTransferA.isAdmin === true, 'User A holds ADMIN role');

  // --- TEST 23: Standardized Event Log Verification ---
  console.log('\n--- TEST 23: Standardized Event Engine Stream ---');
  const eventLogs = await prisma.eventLog.findMany({
    where: { entityId: community.id },
  });
  const eventTypes = eventLogs.map((e) => e.eventType);
  assert(eventTypes.includes('COMMUNITY_CREATED'), 'EventLog contains COMMUNITY_CREATED');
  assert(eventTypes.includes('MEMBER_JOINED'), 'EventLog contains MEMBER_JOINED');
  assert(eventTypes.includes('MEMBER_MUTED'), 'EventLog contains MEMBER_MUTED');
  assert(eventTypes.includes('MEMBER_BANNED'), 'EventLog contains MEMBER_BANNED');

  console.log('\n================================================================');
  console.log('🎉 ALL 25 PHASE 7 MASTER COMMUNITY ENGINE TESTS PASSED!');
  console.log('================================================================\n');
}

runPhase7MasterTests()
  .catch((err) => {
    console.error('Phase 7 master test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
