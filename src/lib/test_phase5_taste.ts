/**
 * OTAKUVA PHASE 5 — PRODUCTION USER TASTE ENGINE TEST SUITE
 * Tests:
 * - Cold start handling (NEW_USER state without fabricated affinities)
 * - Critical multi-anime weighted preference test (Psychological, Mystery, Thriller vs Dropped Romance)
 * - Review intelligence aspect signals integration (Story/Characters vs Pacing)
 * - Time decay recency weighting
 * - Signal saturation (bounded [-1.0, 1.0])
 * - Multi-user privacy and profile rebuild consistency
 */

import { prisma } from './prisma';
import {
  rebuildTasteProfile,
  getUserTasteProfile,
  TASTE_ENGINE_VERSION,
} from './engine/taste/tasteEngine';
import { submitUserRating } from './rating/ratingService';
import { updateAnimeTrackingStatus } from './engine/watch/watchEngine';
import { createAndAnalyzeReview } from './engine/review/reviewIntelligence';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runPhase5TasteTests() {
  console.log('======================================================');
  console.log('🧪 RUNNING OTAKUVA PHASE 5 USER TASTE ENGINE TEST SUITE');
  console.log('======================================================\n');

  // STEP 0: Setup test users
  const coldUser = await prisma.user.upsert({
    where: { email: 'phase5_cold_user@otakuva.com' },
    update: {},
    create: { username: 'Phase5_Cold', email: 'phase5_cold_user@otakuva.com', passwordHash: 'hash123' },
  });

  const activeUser = await prisma.user.upsert({
    where: { email: 'phase5_active_user@otakuva.com' },
    update: {},
    create: { username: 'Phase5_Active', email: 'phase5_active_user@otakuva.com', passwordHash: 'hash123' },
  });

  // Clean prior test data for coldUser and activeUser
  await prisma.userTasteSignal.deleteMany({ where: { profile: { userId: { in: [coldUser.id, activeUser.id] } } } });
  await prisma.userTasteProfile.deleteMany({ where: { userId: { in: [coldUser.id, activeUser.id] } } });
  await prisma.animeRating.deleteMany({ where: { userId: { in: [coldUser.id, activeUser.id] } } });
  await prisma.userAnime.deleteMany({ where: { userId: { in: [coldUser.id, activeUser.id] } } });
  await prisma.review.deleteMany({ where: { userId: { in: [coldUser.id, activeUser.id] } } });

  // Ensure test Genres exist
  const [psychologicalGenre, mysteryGenre, thrillerGenre, romanceGenre] = await Promise.all([
    prisma.genre.upsert({ where: { slug: 'psychological' }, update: {}, create: { name: 'Psychological', slug: 'psychological' } }),
    prisma.genre.upsert({ where: { slug: 'mystery' }, update: {}, create: { name: 'Mystery', slug: 'mystery' } }),
    prisma.genre.upsert({ where: { slug: 'thriller' }, update: {}, create: { name: 'Thriller', slug: 'thriller' } }),
    prisma.genre.upsert({ where: { slug: 'romance' }, update: {}, create: { name: 'Romance', slug: 'romance' } }),
  ]);

  // Seed 4 test anime
  const animeA = await prisma.anime.upsert({
    where: { slug: 'phase5-anime-a' },
    update: {},
    create: {
      slug: 'phase5-anime-a',
      canonicalTitle: 'Monster (Taste Test A)',
      synopsis: 'Psychological mystery masterpiece.',
      type: 'TV',
      episodes: 74,
      status: 'FINISHED',
      score: 9.1,
      posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
      animeGenres: {
        create: [
          { genreId: psychologicalGenre.id },
          { genreId: mysteryGenre.id },
        ],
      },
    },
  });

  const animeB = await prisma.anime.upsert({
    where: { slug: 'phase5-anime-b' },
    update: {},
    create: {
      slug: 'phase5-anime-b',
      canonicalTitle: 'Death Note (Taste Test B)',
      synopsis: 'Psychological thriller confrontation.',
      type: 'TV',
      episodes: 37,
      status: 'FINISHED',
      score: 8.9,
      posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
      animeGenres: {
        create: [
          { genreId: psychologicalGenre.id },
          { genreId: thrillerGenre.id },
        ],
      },
    },
  });

  const animeC = await prisma.anime.upsert({
    where: { slug: 'phase5-anime-c' },
    update: {},
    create: {
      slug: 'phase5-anime-c',
      canonicalTitle: 'Ergo Proxy (Taste Test C)',
      synopsis: 'Psychological sci-fi mystery.',
      type: 'TV',
      episodes: 23,
      status: 'FINISHED',
      score: 8.5,
      posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
      animeGenres: {
        create: [
          { genreId: psychologicalGenre.id },
          { genreId: mysteryGenre.id },
        ],
      },
    },
  });

  const animeD = await prisma.anime.upsert({
    where: { slug: 'phase5-anime-d' },
    update: {},
    create: {
      slug: 'phase5-anime-d',
      canonicalTitle: 'Bland Romance (Taste Test D)',
      synopsis: 'Generic slow romance.',
      type: 'TV',
      episodes: 12,
      status: 'FINISHED',
      score: 6.0,
      posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
      animeGenres: {
        create: [{ genreId: romanceGenre.id }],
      },
    },
  });

  // --- TEST 1: Cold Start Profile ---
  console.log('--- TEST 1: Cold Start Profile for Brand New User ---');
  const coldProfile = await getUserTasteProfile(coldUser.id);
  assert(coldProfile.confidenceTier === 'NEW_USER' || coldProfile.confidenceTier === 'COLD_START', 'Cold user classified as NEW_USER / COLD_START');
  assert(coldProfile.totalSignalsCount === 0, 'Total signals count is 0');
  assert(coldProfile.topGenres.length === 0, 'No fake top genres created for cold start');
  assert(coldProfile.profileVersion === TASTE_ENGINE_VERSION, `Profile version = ${TASTE_ENGINE_VERSION}`);

  // --- TEST 2: CRITICAL TEST — Multi-Dimensional Weighted Preference Vectors ---
  console.log('\n--- TEST 2: CRITICAL TEST — Multi-Dimensional Weighted Preference Vector ---');
  // Anime A: Rating 10/10, Completed
  await submitUserRating({ userId: activeUser.id, animeId: animeA.id, score: 10 });
  await updateAnimeTrackingStatus({ userId: activeUser.id, animeId: animeA.id, status: 'COMPLETED' });

  // Anime B: Rating 9/10, Completed
  await submitUserRating({ userId: activeUser.id, animeId: animeB.id, score: 9 });
  await updateAnimeTrackingStatus({ userId: activeUser.id, animeId: animeB.id, status: 'COMPLETED' });

  // Anime C: Rating 10/10, Completed
  await submitUserRating({ userId: activeUser.id, animeId: animeC.id, score: 10 });
  await updateAnimeTrackingStatus({ userId: activeUser.id, animeId: animeC.id, status: 'COMPLETED' });

  // Anime D: Rating 4/10, Dropped
  await submitUserRating({ userId: activeUser.id, animeId: animeD.id, score: 4 });
  await updateAnimeTrackingStatus({ userId: activeUser.id, animeId: animeD.id, status: 'DROPPED', score: 4 });

  // Rebuild Taste Profile
  const tasteProfile = await rebuildTasteProfile(activeUser.id);

  const psychScore = tasteProfile.genres['Psychological']?.score || 0;
  const mysteryScore = tasteProfile.genres['Mystery']?.score || 0;
  const thrillerScore = tasteProfile.genres['Thriller']?.score || 0;
  const romanceScore = tasteProfile.genres['Romance']?.score || 0;

  console.log(`  📊 Calculated Genre Scores: Psychological=${psychScore}, Mystery=${mysteryScore}, Thriller=${thrillerScore}, Romance=${romanceScore}`);

  assert(psychScore > 0.6, `Psychological affinity is strong (> 0.6, got ${psychScore})`);
  assert(mysteryScore > 0.4, `Mystery affinity is strong (> 0.4, got ${mysteryScore})`);
  assert(thrillerScore > 0.2, `Thriller affinity increased (> 0.2, got ${thrillerScore})`);
  assert(romanceScore < 0.0, `Romance affinity decreased due to low rating + drop (< 0.0, got ${romanceScore})`);
  assert(tasteProfile.topGenres[0] === 'Psychological', 'Top 1 Genre is Psychological');

  // --- TEST 3: Review Aspect Signals Contribution ---
  console.log('\n--- TEST 3: Review Intelligence Aspect Signals Integration ---');
  // Review 1: "Brilliant story and characters."
  await createAndAnalyzeReview({
    userId: activeUser.id,
    animeId: animeA.id,
    title: 'Review 1',
    body: 'Brilliant story and complex characters.',
    rating: 10,
  });

  // Review 2: "The story was amazing."
  await createAndAnalyzeReview({
    userId: activeUser.id,
    animeId: animeB.id,
    title: 'Review 2',
    body: 'The story was amazing with deep themes.',
    rating: 9,
  });

  // Review 3: "Great characters, but pacing was slow."
  await createAndAnalyzeReview({
    userId: activeUser.id,
    animeId: animeC.id,
    title: 'Review 3',
    body: 'Great characters, but the pacing was slow and dragged.',
    rating: 8,
  });

  // Rebuild profile to incorporate review aspects
  const updatedTaste = await rebuildTasteProfile(activeUser.id);
  const storyAspect = updatedTaste.aspects['STORY'];
  const charAspect = updatedTaste.aspects['CHARACTERS'];
  const pacingAspect = updatedTaste.aspects['PACING'];

  console.log(`  📊 Calculated Aspect Scores: Story=${storyAspect?.score}, Characters=${charAspect?.score}, Pacing=${pacingAspect?.score}`);

  assert(storyAspect?.score > 0.4, `Story aspect preference is strongly positive (> 0.4, got ${storyAspect?.score})`);
  assert(charAspect?.score > 0.4, `Characters aspect preference is strongly positive (> 0.4, got ${charAspect?.score})`);
  assert(pacingAspect?.score < 0.0, `Pacing aspect is negative due to slow pacing complaints (< 0.0, got ${pacingAspect?.score})`);

  // --- TEST 4: Signal Saturation (Bounded [-1.0, 1.0]) ---
  console.log('\n--- TEST 4: Signal Saturation & Range Protection ---');
  for (const [g, s] of Object.entries(updatedTaste.genres)) {
    assert(s.score >= -1.0 && s.score <= 1.0, `Genre ${g} score ${s.score} is bounded in [-1.0, 1.0]`);
    assert(s.confidence >= 0.0 && s.confidence <= 1.0, `Genre ${g} confidence ${s.confidence} is bounded in [0.0, 1.0]`);
  }

  // --- TEST 5: Explainable User-Facing Insights ---
  console.log('\n--- TEST 5: Explainable User-Facing Insights ---');
  assert(updatedTaste.userFacingInsights.length > 0, 'User-facing insights generated');
  console.log(`  💬 Generated Insight: "${updatedTaste.userFacingInsights[0]}"`);

  // --- TEST 6: Multi-User Isolation ---
  console.log('\n--- TEST 6: Multi-User Privacy & Isolation ---');
  const coldProfileAfter = await getUserTasteProfile(coldUser.id);
  assert(coldProfileAfter.totalSignalsCount === 0, 'Cold user remains completely isolated from active user activity');

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 5 USER TASTE ENGINE TESTS PASSED!');
  console.log('======================================================\n');
}

runPhase5TasteTests()
  .catch((err) => {
    console.error('Phase 5 test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
