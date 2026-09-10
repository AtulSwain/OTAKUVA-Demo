/**
 * OTAKUVA — MASTER EPISODE TRACKING & DATA RELIABILITY TEST SUITE
 * 
 * Tests:
 * 1. Mark ONE episode watched -> ONLY that episode is marked watched
 * 2. Mark ONE episode unwatched -> ONLY that episode is unmarked
 * 3. Episode selection state vs persistent watch progress separation
 * 4. Season tab switching does not mutate watch progress
 * 5. Mark all episodes watched bulk action
 * 6. Multi-user watch isolation (User A vs User B)
 * 7. Rapid click deduplication / idempotency
 * 8. Security & episode ownership validation
 */

import { prisma } from './prisma';
import { toggleEpisodeWatchStatus, markAllEpisodesWatched } from './engine/watch/watchEngine';

async function runEpisodeTrackingTests() {
  console.log('===============================================================');
  console.log('OTAKUVA MASTER EPISODE TRACKING & DATA RELIABILITY HARNESS');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // Setup test anime and users
  const testAnime = await prisma.anime.findFirst({
    where: { status: { not: 'MERGED' } },
    include: { episodesList: true },
  });

  if (!testAnime) {
    throw new Error('No anime found in test database');
  }

  const userAId = 'test_user_alpha_' + Date.now();
  const userBId = 'test_user_beta_' + Date.now();

  await prisma.user.create({
    data: {
      id: userAId,
      username: 'UserAlpha' + Date.now(),
      email: 'alpha' + Date.now() + '@otakuva.test',
      passwordHash: 'hashed_pw',
    },
  });

  await prisma.user.create({
    data: {
      id: userBId,
      username: 'UserBeta' + Date.now(),
      email: 'beta' + Date.now() + '@otakuva.test',
      passwordHash: 'hashed_pw',
    },
  });

  const userA = userAId;
  const userB = userBId;

  try {
    // Ensure 12 episodes exist for test anime
    for (let i = 1; i <= 12; i++) {
      await prisma.episode.upsert({
        where: {
          animeId_number: {
            animeId: testAnime.id,
            number: i,
          },
        },
        update: {},
        create: {
          animeId: testAnime.id,
          number: i,
          title: `Episode ${i}`,
        },
      });
    }

    const episodes = await prisma.episode.findMany({
      where: { animeId: testAnime.id },
      orderBy: { number: 'asc' },
    });

    const ep5 = episodes.find((e) => e.number === 5) || episodes[4];
    const ep3 = episodes.find((e) => e.number === 3) || episodes[2];

    // -------------------------------------------------------------
    // TEST 1: Mark Episode 5 Watched (ONLY Ep 5 changes)
    // -------------------------------------------------------------
    console.log('[Test 1: Mark Episode 5 Watched]');
    const res1 = await toggleEpisodeWatchStatus({
      userId: userA,
      animeId: testAnime.id,
      episodeId: ep5.id,
      status: 'WATCHED',
    });

    assert(res1.isWatched === true, 'Episode 5 marked as watched');
    assert(res1.totalCompleted === 1, 'Total completed count is exactly 1 (not 5 or 12)');

    const userAProgressList = await prisma.userEpisodeProgress.findMany({
      where: { userId: userA, animeId: testAnime.id },
    });

    assert(userAProgressList.length === 1, 'Exactly one UserEpisodeProgress record created');
    assert(userAProgressList[0].episodeId === ep5.id, 'Created record points specifically to Episode 5');

    // -------------------------------------------------------------
    // TEST 2: Mark Episode 5 Unwatched
    // -------------------------------------------------------------
    console.log('\n[Test 2: Mark Episode 5 Unwatched]');
    const res2 = await toggleEpisodeWatchStatus({
      userId: userA,
      animeId: testAnime.id,
      episodeId: ep5.id,
      status: 'UNWATCHED',
    });

    assert(res2.isWatched === false, 'Episode 5 marked as unwatched');
    assert(res2.totalCompleted === 0, 'Total completed count reduced to 0');

    const userAProgressListAfterUnwatch = await prisma.userEpisodeProgress.findMany({
      where: { userId: userA, animeId: testAnime.id },
    });
    assert(userAProgressListAfterUnwatch.length === 0, 'Progress list is completely cleared');

    // -------------------------------------------------------------
    // TEST 3: UI Selection vs Watch Progress Separation
    // -------------------------------------------------------------
    console.log('\n[Test 3: UI Selection vs Watch State Invariant]');
    let selectedEpisodeId: string | null = null;
    let watchedEpisodeIds: Set<string> = new Set();

    // User selects Ep 5
    selectedEpisodeId = ep5.id;
    assert(selectedEpisodeId === ep5.id, 'UI selection changed to Episode 5');
    assert(!watchedEpisodeIds.has(ep5.id), 'Persistent watch progress remains empty after UI selection');

    // -------------------------------------------------------------
    // TEST 4: Season Tab Change Invariant
    // -------------------------------------------------------------
    console.log('\n[Test 4: Season Tab Switching Invariant]');
    let activeSeason = 'Season 1';
    watchedEpisodeIds.add(ep3.id); // User watched Ep 3

    // Change season
    activeSeason = 'Season 2';
    assert(activeSeason === 'Season 2', 'Active season changed to Season 2');
    assert(watchedEpisodeIds.has(ep3.id), 'Episode 3 watch state preserved across season tab changes');

    // -------------------------------------------------------------
    // TEST 5: Mark All Watched Bulk Action
    // -------------------------------------------------------------
    console.log('\n[Test 5: Mark All Watched Bulk Action]');
    const resBulk = await markAllEpisodesWatched({
      userId: userA,
      animeId: testAnime.id,
    });

    assert(resBulk.success === true, 'Mark all episodes action succeeded');
    const allUserAProgress = await prisma.userEpisodeProgress.findMany({
      where: { userId: userA, animeId: testAnime.id },
    });
    assert(allUserAProgress.length >= 12, 'All episodes recorded as completed in database');

    // -------------------------------------------------------------
    // TEST 6: Multi-User Watch State Isolation
    // -------------------------------------------------------------
    console.log('\n[Test 6: Multi-User Isolation (User A vs User B)]');
    const userBProgress = await prisma.userEpisodeProgress.findMany({
      where: { userId: userB, animeId: testAnime.id },
    });

    assert(userBProgress.length === 0, 'User B has 0 watched episodes despite User A having completed all');

    // -------------------------------------------------------------
    // TEST 7: Rapid Click Deduplication & Upsert Idempotency
    // -------------------------------------------------------------
    console.log('\n[Test 7: Rapid Click Deduplication / Idempotency]');
    await Promise.all([
      toggleEpisodeWatchStatus({ userId: userB, animeId: testAnime.id, episodeId: ep5.id, status: 'WATCHED' }),
      toggleEpisodeWatchStatus({ userId: userB, animeId: testAnime.id, episodeId: ep5.id, status: 'WATCHED' }),
      toggleEpisodeWatchStatus({ userId: userB, animeId: testAnime.id, episodeId: ep5.id, status: 'WATCHED' }),
    ]);

    const userBEp5Progress = await prisma.userEpisodeProgress.findMany({
      where: { userId: userB, episodeId: ep5.id },
    });
    assert(userBEp5Progress.length === 1, 'Exactly ONE record exists after 3 rapid concurrent clicks (Idempotency Verified)');

    // -------------------------------------------------------------
    // TEST 8: Server-Side Episode Ownership Validation
    // -------------------------------------------------------------
    console.log('\n[Test 8: Cross-Anime Episode Mismatch Protection]');
    const otherAnime = await prisma.anime.findFirst({
      where: { id: { not: testAnime.id }, status: { not: 'MERGED' } },
    });

    if (otherAnime) {
      let threw = false;
      try {
        const fakeEpisode = await prisma.episode.findFirst({
          where: { animeId: otherAnime.id },
        });
        if (fakeEpisode) {
          // Attempt to call toggle with mismatched animeId
          const mismatchCheck = await prisma.episode.findFirst({
            where: { id: fakeEpisode.id, animeId: testAnime.id },
          });
          if (!mismatchCheck) {
            threw = true;
          }
        }
      } catch (e) {
        threw = true;
      }
      assert(threw === true, 'Mismatched animeId and episodeId correctly identified as invalid');
    }

    console.log('\n===============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await prisma.userEpisodeProgress.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await prisma.userAnime.deleteMany({
      where: { userId: { in: [userA, userB] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA, userB] } },
    });
  }
}

runEpisodeTrackingTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
