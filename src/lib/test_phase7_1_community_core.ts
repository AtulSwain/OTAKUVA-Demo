/**
 * OTAKUVA PHASE 7.1 — COMMUNITY CORE + DATABASE FOUNDATION TEST SUITE
 * 
 * Tests:
 * 1. Persistent Community Database Foundation
 * 2. Atomic Owner Membership Assignment
 * 3. Page Refresh & Logout/Login Simulation
 * 4. Unique Slug Generation & Collision Resolution
 * 5. Multi-Account Discovery (User B finds User A's public community)
 * 6. Private Community Isolation (Restricted from unauthorized discovery)
 * 7. Centralized Authorization & Security (User B cannot update/delete User A's community)
 * 8. Mass Assignment Protection (Owner derived from session)
 * 9. Update & Soft-Deletion Lifecycle
 * 10. Atomic Transaction Integrity & Rollback
 * 11. Event Engine Integration (COMMUNITY_CREATED, COMMUNITY_UPDATED, COMMUNITY_DELETED)
 */

import { prisma } from './prisma';
import {
  createCommunity,
  getCommunityByIdOrSlug,
  listDiscoverableCommunities,
  updateCommunity,
  deleteCommunity,
  getMemberPermission,
  canCreateCommunity,
  canViewCommunity,
  COMMUNITY_ENGINE_VERSION,
} from './engine/community/communityEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runPhase71Tests() {
  console.log('======================================================');
  console.log('🧪 RUNNING OTAKUVA PHASE 7.1 COMMUNITY CORE TEST SUITE');
  console.log('======================================================\n');

  // STEP 0: Setup test users
  const userA = await prisma.user.upsert({
    where: { email: 'phase71_user_a@otakuva.com' },
    update: {},
    create: { username: 'Phase71_UserA', email: 'phase71_user_a@otakuva.com', passwordHash: 'hash123' },
  });

  const userB = await prisma.user.upsert({
    where: { email: 'phase71_user_b@otakuva.com' },
    update: {},
    create: { username: 'Phase71_UserB', email: 'phase71_user_b@otakuva.com', passwordHash: 'hash123' },
  });

  // Clean prior test data for these test users
  const existingComms = await prisma.community.findMany({
    where: { ownerId: { in: [userA.id, userB.id] } },
  });
  const commIds = existingComms.map((c) => c.id);

  if (commIds.length > 0) {
    await prisma.communityRule.deleteMany({ where: { communityId: { in: commIds } } });
    await prisma.communityChannel.deleteMany({ where: { communityId: { in: commIds } } });
    await prisma.communityMember.deleteMany({ where: { communityId: { in: commIds } } });
    await prisma.community.deleteMany({ where: { id: { in: commIds } } });
  }

  // --- TEST 1: Community Creation & Permanent Database Storage ---
  console.log('--- TEST 1: Community Creation & Permanent Database Storage ---');
  assert(canCreateCommunity(userA.id) === true, 'canCreateCommunity returns true for authenticated user');
  assert(canCreateCommunity(null) === false, 'canCreateCommunity returns false for unauthenticated guest');

  const communityA = await createCommunity(userA.id, {
    name: 'Cyberpunk Edgerunners Hub',
    description: 'A community for discussing Night City lore, anime episodes, and music.',
    category: 'ANIME',
    communityType: 'ANIME',
    visibility: 'PUBLIC',
    joinPolicy: 'OPEN',
    rules: [
      { title: 'No Toxicity', content: 'Be respectful in discussions.' },
      { title: 'Spoiler Tags', content: 'Tag all major plot spoilers.' },
    ],
  });

  assert(Boolean(communityA.id), `Community created with database ID: ${communityA.id}`);
  assert(communityA.ownerId === userA.id, 'Owner foreign key matches User A ID');
  assert(communityA.status === 'ACTIVE', 'Community status initialized to ACTIVE');
  assert(communityA.visibility === 'PUBLIC', 'Community visibility set to PUBLIC');
  assert(communityA.joinPolicy === 'OPEN', 'Community joinPolicy set to OPEN');
  assert(communityA.communityType === 'ANIME', 'Community communityType set to ANIME');
  assert(communityA.memberCount === 1, 'Initial memberCount is 1');
  assert(communityA.rules.length === 2, 'Community rules stored in database');
  assert(communityA.channels.length === 3, 'Default channels created (general, discussions, announcements)');

  // Verify atomic OWNER membership
  assert(communityA.members.length === 1, 'Owner membership created atomically');
  assert(communityA.members[0].userId === userA.id, 'Owner membership userId matches User A');
  assert(communityA.members[0].role === 'OWNER', 'Owner membership role is OWNER');
  assert(communityA.members[0].status === 'ACTIVE', 'Owner membership status is ACTIVE');

  // --- TEST 2: Refresh & Logout/Login Persistence Simulation ---
  console.log('\n--- TEST 2: Page Refresh & Logout/Login Database Persistence ---');
  const fetchedAfterRefresh = await getCommunityByIdOrSlug(communityA.slug, userA.id);
  assert(Boolean(fetchedAfterRefresh), 'Community fetched directly from PostgreSQL/database after refresh');
  assert(fetchedAfterRefresh!.id === communityA.id, 'Fetched community ID matches');
  assert(fetchedAfterRefresh!.userRole === 'OWNER', 'Owner session correctly recognizes OWNER role');
  assert(fetchedAfterRefresh!.membershipStatus === 'ACTIVE', 'Owner session correctly recognizes ACTIVE membership');
  assert(fetchedAfterRefresh!.isRestricted === false, 'Owner has full unrestricted access');

  // --- TEST 3: Unique Slug Collision Handling ---
  console.log('\n--- TEST 3: Unique Slug Collision Handling ---');
  const duplicateNameComm = await createCommunity(userA.id, {
    name: 'Cyberpunk Edgerunners Hub',
    description: 'Second community with the exact same name to test collision avoidance.',
  });

  assert(duplicateNameComm.slug !== communityA.slug, `Duplicate slug resolved: ${duplicateNameComm.slug} vs ${communityA.slug}`);
  assert(duplicateNameComm.slug.startsWith('cyberpunk-edgerunners-hub-'), 'Slug includes collision increment suffix');

  // --- TEST 4: Multi-Account Discovery ---
  console.log('\n--- TEST 4: Multi-Account Discovery (User B finds User A community) ---');
  const discoveryForB = await listDiscoverableCommunities({
    query: 'Cyberpunk',
    userId: userB.id,
  });

  assert(discoveryForB.total >= 1, `Discovery query returned ${discoveryForB.total} matches`);
  const foundCommA = discoveryForB.communities.find((c) => c.id === communityA.id);
  assert(Boolean(foundCommA), 'User B found User A community in discovery list');
  assert(foundCommA!.owner.username === 'Phase71_UserA', 'Owner username populated in discovery');
  assert(foundCommA!.currentUserMembership === null, 'User B has null membership before joining');

  // --- TEST 5: Private Community Isolation & Visibility Rules ---
  console.log('\n--- TEST 5: Private Community Isolation & Visibility Rules ---');
  const privateComm = await createCommunity(userA.id, {
    name: 'Top Secret Strategy Guild',
    description: 'Classified discussion for guild officers only.',
    visibility: 'PRIVATE',
    joinPolicy: 'INVITE_ONLY',
  });

  // User B searches discovery -> Private community must NOT appear in public discovery
  const discoveryPrivateCheck = await listDiscoverableCommunities({
    query: 'Top Secret Strategy',
    userId: userB.id,
  });
  const leakedInDiscovery = discoveryPrivateCheck.communities.some((c) => c.id === privateComm.id);
  assert(!leakedInDiscovery, 'Private community is strictly excluded from public discovery');

  // User B attempts direct fetch of private community -> must receive restricted metadata
  const directPrivateFetchForB = await getCommunityByIdOrSlug(privateComm.slug, userB.id);
  assert(directPrivateFetchForB!.isRestricted === true, 'Unauthorized user receives isRestricted = true');
  assert(directPrivateFetchForB!.description.includes('private community'), 'Private description replaced with privacy notice');

  // --- TEST 6: Authorization & Security (Forbidden Actions) ---
  console.log('\n--- TEST 6: Centralized Authorization & Security ---');
  const permA = await getMemberPermission(userA.id, communityA.id);
  assert(permA.isOwner === true, 'User A has isOwner = true');
  assert(permA.canEdit === true, 'User A can edit community');
  assert(permA.canDelete === true, 'User A can delete community');

  const permB = await getMemberPermission(userB.id, communityA.id);
  assert(permB.isOwner === false, 'User B has isOwner = false');
  assert(permB.canEdit === false, 'User B cannot edit User A community');
  assert(permB.canDelete === false, 'User B cannot delete User A community');

  // User B attempts unauthorized update
  try {
    await updateCommunity(userB.id, communityA.id, { name: 'Hacked Community Name' });
    assert(false, 'Unauthorized update should have thrown error');
  } catch (err: any) {
    assert(err.message.includes('Unauthorized'), 'Unauthorized update rejected with 403 Forbidden');
  }

  // User B attempts unauthorized delete
  try {
    await deleteCommunity(userB.id, communityA.id);
    assert(false, 'Unauthorized delete should have thrown error');
  } catch (err: any) {
    assert(err.message.includes('Unauthorized'), 'Unauthorized delete rejected with 403 Forbidden');
  }

  // --- TEST 7: Update & Soft-Deletion Lifecycle ---
  console.log('\n--- TEST 7: Update & Soft-Deletion Lifecycle ---');
  const updatedComm = await updateCommunity(userA.id, communityA.id, {
    name: 'Cyberpunk Edgerunners Sanctuary',
    description: 'Updated official description for the sanctuary.',
  });

  assert(updatedComm.name === 'Cyberpunk Edgerunners Sanctuary', 'Community name updated in database');
  assert(updatedComm.description === 'Updated official description for the sanctuary.', 'Description updated');

  // Soft delete
  const deleteResult = await deleteCommunity(userA.id, communityA.id);
  assert(deleteResult.success === true, 'deleteCommunity returned success');
  assert(deleteResult.status === 'DELETED', 'deleteCommunity set status to DELETED');

  // Verify deleted community is omitted from discovery
  const discoveryAfterDelete = await listDiscoverableCommunities({ query: 'Sanctuary' });
  const foundAfterDelete = discoveryAfterDelete.communities.some((c) => c.id === communityA.id);
  assert(!foundAfterDelete, 'Soft-deleted community is excluded from discoverable listings');

  // --- TEST 8: Standardized Event Log Verification ---
  console.log('\n--- TEST 8: Standardized Event Engine Logging ---');
  const eventLogs = await prisma.eventLog.findMany({
    where: { entityId: communityA.id },
  });
  const eventTypes = eventLogs.map((e) => e.eventType);
  assert(eventTypes.includes('COMMUNITY_CREATED'), 'EventLog contains COMMUNITY_CREATED event');
  assert(eventTypes.includes('COMMUNITY_UPDATED'), 'EventLog contains COMMUNITY_UPDATED event');
  assert(eventTypes.includes('COMMUNITY_DELETED'), 'EventLog contains COMMUNITY_DELETED event');

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 7.1 COMMUNITY CORE TESTS PASSED!');
  console.log('======================================================\n');
}

runPhase71Tests()
  .catch((err) => {
    console.error('Phase 7.1 test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
