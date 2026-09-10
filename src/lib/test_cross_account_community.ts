/**
 * Automated Verification Test Suite for
 * OTAKUVA Community Cross-Account Persistence & Membership.
 */

import { prisma } from './prisma';
import {
  createCommunity,
  listDiscoverableCommunities,
  getCommunityBySlug,
  joinCommunity,
  leaveCommunity,
} from './community/communityService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runCrossAccountCommunityTests() {
  console.log('======================================================');
  console.log('🧪 RUNNING OTAKUVA COMMUNITY CROSS-ACCOUNT TEST SUITE');
  console.log('======================================================\n');

  // Step 1: Ensure Account A and Account B exist with distinct persistent IDs
  const accountA = await prisma.user.upsert({
    where: { email: 'account_a_creator@otakuva.com' },
    update: {},
    create: {
      username: 'AccountA_Creator',
      email: 'account_a_creator@otakuva.com',
      passwordHash: 'seeded_hash_123',
    },
  });

  const accountB = await prisma.user.upsert({
    where: { email: 'account_b_explorer@otakuva.com' },
    update: {},
    create: {
      username: 'AccountB_Explorer',
      email: 'account_b_explorer@otakuva.com',
      passwordHash: 'seeded_hash_123',
    },
  });

  assert(accountA.id !== accountB.id, `Distinct Account IDs: A=${accountA.id}, B=${accountB.id}`);

  // Clean up any prior test community
  const testCommunityName = 'Anime Theory & Lore Club';
  const existingComm = await prisma.community.findFirst({
    where: { name: testCommunityName },
  });
  if (existingComm) {
    await prisma.community.delete({ where: { id: existingComm.id } });
  }

  // --- STEP 2: Account A Creates Community ---
  console.log('\n--- STEP 1: Account A Creates "Anime Theory & Lore Club" ---');
  const community = await createCommunity(accountA.id, {
    name: testCommunityName,
    description: 'A dedicated sanctuary for deep anime analysis, foreshadowing, and philosophical discussions.',
    category: 'ANIME',
    visibility: 'PUBLIC',
    rules: [
      { title: 'Respectful Debate', content: 'Constructive theories only; no toxic remarks.' },
      { title: 'Spoiler Tags', content: 'Mark unadapted plot points.' },
    ],
  });

  assert(Boolean(community.id), `Community created in database with ID: ${community.id}`);
  assert(community.ownerId === accountA.id, 'Community ownerId matches Account A ID');
  assert(community.visibility === 'PUBLIC', 'Community visibility is PUBLIC');

  // Verify owner membership record in database
  const ownerMembership = await prisma.communityMember.findUnique({
    where: {
      communityId_userId: {
        communityId: community.id,
        userId: accountA.id,
      },
    },
  });
  assert(Boolean(ownerMembership), 'Owner membership record exists in database');
  assert(ownerMembership!.role === 'OWNER', 'Owner membership role is OWNER');
  assert(ownerMembership!.status === 'ACTIVE', 'Owner membership status is ACTIVE');

  // --- STEP 3: Account B Discovers Community ---
  console.log('\n--- STEP 2: Account B Discovers Community Created by Account A ---');
  const discoveryForB = await listDiscoverableCommunities({ userId: accountB.id });
  const foundInDiscovery = discoveryForB.communities.find((c) => c.id === community.id);

  assert(Boolean(foundInDiscovery), 'Community created by Account A is visible in discovery to Account B');
  assert(foundInDiscovery!.owner.username === 'AccountA_Creator', 'Community owner identified as Account A');
  assert(foundInDiscovery!.currentUserMembership === null, 'Account B is not yet a member (currentUserMembership is null)');
  assert(foundInDiscovery!.membershipStatus === null, 'Account B membershipStatus is null');

  // --- STEP 4: Guest Discovers Community ---
  console.log('\n--- STEP 3: Guest (Unauthenticated) Discovers Community ---');
  const discoveryForGuest = await listDiscoverableCommunities({ userId: null });
  const foundInGuest = discoveryForGuest.communities.find((c) => c.id === community.id);
  assert(Boolean(foundInGuest), 'Community is discoverable by unauthenticated guests');
  assert(foundInGuest!.membershipStatus === null, 'Guest has no membershipStatus');

  // --- STEP 5: Account B Joins Community ---
  console.log('\n--- STEP 4: Account B Joins the Community ---');
  const joinResult = await joinCommunity(accountB.id, community.slug);
  assert(joinResult.success === true, 'Join community API returned success');
  assert(joinResult.status === 'ACTIVE', 'Account B status is ACTIVE');
  assert(joinResult.role === 'MEMBER', 'Account B role is MEMBER');
  assert(joinResult.memberCount === 2, 'Total member count updated to 2');

  // Verify persistent record in CommunityMember table
  const memberRecordB = await prisma.communityMember.findUnique({
    where: {
      communityId_userId: {
        communityId: community.id,
        userId: accountB.id,
      },
    },
  });
  assert(Boolean(memberRecordB), 'Persistent database record created for Account B membership');
  assert(memberRecordB!.role === 'MEMBER', 'Persistent role in database is MEMBER');
  assert(memberRecordB!.status === 'ACTIVE', 'Persistent status in database is ACTIVE');

  // --- STEP 6: Cross-Account Role & State Verification ---
  console.log('\n--- STEP 5: Cross-Account State & Role Verification ---');
  // Query as Account B
  const viewAsB = await getCommunityBySlug(community.slug, accountB.id);
  assert(viewAsB !== null, 'Account B loaded community detail');
  assert(viewAsB!.userRole === 'MEMBER', 'Account B sees own role as MEMBER');
  assert(viewAsB!.membershipStatus === 'ACTIVE', 'Account B sees membershipStatus as ACTIVE');
  assert(viewAsB!.memberCount === 2, 'Account B sees memberCount = 2');

  // Query as Account A
  const viewAsA = await getCommunityBySlug(community.slug, accountA.id);
  assert(viewAsA !== null, 'Account A loaded community detail');
  assert(viewAsA!.userRole === 'OWNER', 'Account A sees own role as OWNER');
  assert(viewAsA!.membershipStatus === 'ACTIVE', 'Account A sees membershipStatus as ACTIVE');
  assert(viewAsA!.memberCount === 2, 'Account A sees memberCount = 2');

  // --- STEP 7: Account B Leaves Community ---
  console.log('\n--- STEP 6: Account B Leaves Community ---');
  const leaveResult = await leaveCommunity(accountB.id, community.slug);
  assert(leaveResult.success === true, 'Leave community API returned success');
  assert(leaveResult.memberCount === 1, 'Member count updated to 1');

  const memberAfterLeave = await prisma.communityMember.findUnique({
    where: {
      communityId_userId: {
        communityId: community.id,
        userId: accountB.id,
      },
    },
  });
  assert(!memberAfterLeave, 'Membership record deleted from database');

  // Attempting owner leave must be rejected
  let ownerLeaveError = false;
  try {
    await leaveCommunity(accountA.id, community.slug);
  } catch (err: any) {
    ownerLeaveError = err.message.includes('owner cannot leave');
  }
  assert(ownerLeaveError, 'Owner is prevented from leaving without ownership transfer');

  console.log('\n======================================================');
  console.log('🎉 ALL CROSS-ACCOUNT COMMUNITY TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runCrossAccountCommunityTests()
  .catch((err) => {
    console.error('Community test runner failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
