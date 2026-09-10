/**
 * Automated Verification Test Suite for
 * OTAKUVA Authentication-Aware Rating, Intent Preservation,
 * Guest vs Authenticated Gating, and Personalization Engine.
 */

import { prisma } from './prisma';
import { submitUserRating, getUserRating } from './rating/ratingService';
import { buildUserTasteProfile, getPersonalizedRecommendations } from './personalizationService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runAuthGatingTests() {
  console.log('======================================================');
  console.log('🧪 RUNNING OTAKUVA AUTHENTICATION & PERSONALIZATION TEST SUITE');
  console.log('======================================================\n');

  // Ensure test users exist
  const testUser = await prisma.user.upsert({
    where: { email: 'auth_test_user@otakuva.com' },
    update: {},
    create: {
      username: 'AuthTestExplorer',
      email: 'auth_test_user@otakuva.com',
      passwordHash: 'seeded_hash_123',
    },
  });

  // Ensure monster and other flagships exist
  const monster = await prisma.anime.findFirst({
    where: { slug: 'monster' },
  });
  assert(Boolean(monster), 'Monster anime exists in database');

  const frieren = await prisma.anime.findFirst({
    where: { slug: 'frieren-beyond-journeys-end' },
  });
  assert(Boolean(frieren), 'Frieren anime exists in database');

  // --- TEST 1: GUEST USER READ-ONLY DISCOVERY ---
  console.log('\n--- TEST 1: Guest User Read-Only Discovery ---');
  const guestRecs = await getPersonalizedRecommendations(null, 5);
  assert(guestRecs.isPersonalized === false, 'Guest receives isPersonalized = false');
  assert(guestRecs.recommendations.length > 0, 'Guest receives popular community discovery list');
  assert(
    Boolean(guestRecs.recommendations[0].reason.label),
    `Guest discovery has reason tag: "${guestRecs.recommendations[0].reason.label}"`
  );

  // --- TEST 2: AUTHENTICATED USER INTERACTION & TASTE PROFILE ---
  console.log('\n--- TEST 2: Authenticated User Rating & Taste Profile ---');
  if (monster && frieren) {
    // 1. Submit rating for Monster with high scores
    await submitUserRating({
      userId: testUser.id,
      animeId: monster.id,
      score: 9.8,
      categoryScores: {
        STORY: 10.0,
        CHARACTERS: 9.9,
        ANIMATION: 8.8,
        DIRECTION: 9.9,
        MUSIC: 9.2,
        ENJOYMENT: 9.8,
      },
    });

    // 2. Mark Monster as COMPLETED
    await prisma.userAnime.upsert({
      where: {
        userId_animeId: {
          userId: testUser.id,
          animeId: monster.id,
        },
      },
      update: {
        status: 'COMPLETED',
        episodesWatched: 74,
        favorite: true,
      },
      create: {
        userId: testUser.id,
        animeId: monster.id,
        status: 'COMPLETED',
        episodesWatched: 74,
        favorite: true,
        startDate: new Date(),
      },
    });

    const profile = await buildUserTasteProfile(testUser.id);
    assert(Boolean(profile), 'User taste profile generated successfully');
    assert(profile!.totalRated >= 1, `Total rated count is ${profile!.totalRated}`);
    assert(profile!.completedAnimeIds.includes(monster.id), 'Profile includes completed anime');
    assert(profile!.favoriteAnimeIds.includes(monster.id), 'Profile includes favorite anime');
    assert(profile!.topGenres.length > 0, `Top genres identified: ${profile!.topGenres.map((g) => g.genre).join(', ')}`);

    // --- TEST 3: PERSONALIZED RECOMMENDATIONS ENGINE ---
    console.log('\n--- TEST 3: Algorithmic Personalized Recommendations ---');
    const userRecs = await getPersonalizedRecommendations(testUser.id, 5);
    assert(userRecs.isPersonalized === true, 'Authenticated user receives isPersonalized = true');
    assert(userRecs.recommendations.length > 0, 'Personalized recommendations generated');

    // Verify Monster (already watched) is filtered out
    const includesWatched = userRecs.recommendations.some((r) => r.id === monster.id);
    assert(!includesWatched, 'Already completed anime (Monster) is excluded from recommendations');

    // Verify recommendation reason
    const topRec = userRecs.recommendations[0];
    assert(topRec.affinityPercentage >= 65, `Affinity percentage is high (${topRec.affinityPercentage}%)`);
    assert(Boolean(topRec.reason.label), `Personalized recommendation has reason label: "${topRec.reason.label}"`);
  }

  // --- TEST 4: USER RATING ISOLATION & PRIVACY ---
  console.log('\n--- TEST 4: User Rating Isolation & Privacy ---');
  if (monster) {
    const fetchedUserRating = await getUserRating(testUser.id, monster.id);
    assert(fetchedUserRating.hasRated === true, 'User rating query returns hasRated = true for owner');
    assert(fetchedUserRating.yourRating === 9.8, 'User rating query returns exact score (9.8)');

    const otherUserRating = await getUserRating('non_existent_guest_user', monster.id);
    assert(otherUserRating.hasRated === false, 'Guest user query returns hasRated = false');
    assert(otherUserRating.yourRating === null, 'Guest user query returns yourRating = null');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL AUTHENTICATION & PERSONALIZATION TESTS PASSED!');
  console.log('======================================================\n');
}

runAuthGatingTests()
  .catch((err) => {
    console.error('Test runner failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
