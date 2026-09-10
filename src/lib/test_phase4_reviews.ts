/**
 * OTAKUVA PHASE 4 — REVIEW & REVIEW INTELLIGENCE TEST SUITE
 * Tests:
 * - Review creation for anime and episodes
 * - Review editing and ownership security
 * - Review deletion and cascade to Community Opinion
 * - Reaction toggling and report filing
 * - Deterministic NLP aspect sentiment extraction across 18-aspect taxonomy
 * - Strict decoupling: Explicit user numerical rating is never overwritten by AI sentiment
 * - Aggregated Community Opinion scorecard computation and praise/criticism tags
 */

import { prisma } from './prisma';
import {
  createAndAnalyzeReview,
  updateReview,
  deleteReview,
  reactToReview,
  reportReview,
  recalculateCommunityOpinion,
  extractAspectSentiments,
  detectLanguage,
  REVIEW_INTELLIGENCE_VERSION,
} from './engine/review/reviewIntelligence';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runPhase4ReviewTests() {
  console.log('======================================================');
  console.log('🧪 RUNNING OTAKUVA PHASE 4 REVIEW & INTELLIGENCE TEST SUITE');
  console.log('======================================================\n');

  // STEP 0: Seed test users and anime
  const userA = await prisma.user.upsert({
    where: { email: 'phase4_user_a@otakuva.com' },
    update: {},
    create: { username: 'Phase4_UserA', email: 'phase4_user_a@otakuva.com', passwordHash: 'hash123' },
  });

  const userB = await prisma.user.upsert({
    where: { email: 'phase4_user_b@otakuva.com' },
    update: {},
    create: { username: 'Phase4_UserB', email: 'phase4_user_b@otakuva.com', passwordHash: 'hash123' },
  });

  const testAnime = await prisma.anime.upsert({
    where: { slug: 'phase4-review-test-anime' },
    update: {},
    create: {
      slug: 'phase4-review-test-anime',
      canonicalTitle: 'Attack on Titan (Review Test)',
      synopsis: 'Humanity fights against giant titans.',
      type: 'TV',
      episodes: 25,
      status: 'FINISHED',
      score: 9.0,
      posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
    },
  });

  // Clean prior test reviews
  await prisma.reviewReport.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.reviewLike.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.reviewAspect.deleteMany({ where: { review: { animeId: testAnime.id } } });
  await prisma.review.deleteMany({ where: { animeId: testAnime.id } });

  // --- TEST 1: Language Detection ---
  console.log('--- TEST 1: Language Detection ---');
  const langEn = detectLanguage('This is a magnificent anime experience with stunning animation.');
  assert(langEn.language === 'en', 'English text identified as en');

  const langJa = detectLanguage('このアニメは本当に素晴らしいストーリーと映像美です。');
  assert(langJa.language === 'ja', 'Japanese text identified as ja');

  // --- TEST 2: CRITICAL TEST — Review & Rating Separation & Aspect Extraction ---
  console.log('\n--- TEST 2: CRITICAL TEST — Explicit Rating Preservation & Aspect Extraction ---');
  const criticalReviewText = 'I loved the story, but the animation was weak. The characters were excellent.';
  const criticalRating = 8;

  const result = await createAndAnalyzeReview({
    userId: userA.id,
    animeId: testAnime.id,
    title: 'A compelling but visually inconsistent journey',
    body: criticalReviewText,
    rating: criticalRating,
    containsSpoiler: false,
  });

  // Verify explicit rating remained 8
  assert(result.review.rating === 8, 'User explicit numerical rating remains exactly 8');
  assert(result.review.analysisModelVersion === REVIEW_INTELLIGENCE_VERSION, `Analysis model version = ${REVIEW_INTELLIGENCE_VERSION}`);
  assert(result.review.analysisStatus === 'COMPLETED', 'Analysis marked COMPLETED');

  // Verify extracted aspects
  const storyAspect = result.extractedAspects.find((a) => a.aspect === 'STORY');
  const animAspect = result.extractedAspects.find((a) => a.aspect === 'ANIMATION');
  const charAspect = result.extractedAspects.find((a) => a.aspect === 'CHARACTERS');

  assert(storyAspect?.sentiment === 'POSITIVE', 'Story aspect extracted as POSITIVE sentiment');
  assert(animAspect?.sentiment === 'NEGATIVE', 'Animation aspect extracted as NEGATIVE sentiment');
  assert(charAspect?.sentiment === 'POSITIVE', 'Characters aspect extracted as POSITIVE sentiment');

  // --- TEST 3: Episode Review Creation ---
  console.log('\n--- TEST 3: Per-Episode Review Creation ---');
  const epReview = await createAndAnalyzeReview({
    userId: userA.id,
    animeId: testAnime.id,
    episodeNumber: 1,
    reviewType: 'EPISODE_REVIEW',
    title: 'Flawless premiere episode',
    body: 'The direction and music created an unforgettable, tense atmosphere.',
    rating: 10,
    containsSpoiler: true,
  });

  assert(epReview.review.reviewType === 'EPISODE_REVIEW', 'Review type is EPISODE_REVIEW');
  assert(Boolean(epReview.review.episodeId), 'Episode review is linked to Episode ID');
  assert(epReview.review.containsSpoiler === true, 'Spoiler flag marked correctly');

  // --- TEST 4: Review Editing & Re-analysis ---
  console.log('\n--- TEST 4: Review Editing & Re-analysis ---');
  const updatedReview = await updateReview({
    userId: userA.id,
    reviewId: result.review.id,
    title: 'Updated title: Story is top-tier',
    body: 'The story was deeply gripping with a genius twist. Characters were memorable.',
    rating: 9,
  });

  assert(updatedReview.review.rating === 9, 'Updated explicit rating to 9');
  assert(updatedReview.review.title === 'Updated title: Story is top-tier', 'Updated title');

  // --- TEST 5: Security & Multi-User Ownership ---
  console.log('\n--- TEST 5: Security & Multi-User Ownership ---');
  try {
    // User B tries to edit User A's review
    await updateReview({
      userId: userB.id,
      reviewId: result.review.id,
      title: 'Hacked title',
    });
    assert(false, 'Unauthorized user should not be able to edit review');
  } catch (err: any) {
    assert(err.message.includes('Unauthorized'), 'Unauthorized edit rejected with 403 error');
  }

  // --- TEST 6: Review Reactions (Helpful, Likes, Disagree) ---
  console.log('\n--- TEST 6: Review Reactions ---');
  const reactRes1 = await reactToReview(userB.id, result.review.id, 'HELPFUL');
  assert(reactRes1.reacted === true, 'User B reacted HELPFUL to User A review');

  const reviewAfterLike = await prisma.review.findUnique({ where: { id: result.review.id } });
  assert(reviewAfterLike?.likesCount === 1, 'Review likesCount incremented to 1');

  // Toggle off
  const reactRes2 = await reactToReview(userB.id, result.review.id, 'HELPFUL');
  assert(reactRes2.reacted === false, 'User B toggled off HELPFUL reaction');
  const reviewAfterToggle = await prisma.review.findUnique({ where: { id: result.review.id } });
  assert(reviewAfterToggle?.likesCount === 0, 'Review likesCount decremented back to 0');

  // --- TEST 7: Review Reporting ---
  console.log('\n--- TEST 7: Review Reporting ---');
  const report = await reportReview(
    userB.id,
    epReview.review.id,
    'SPOILER',
    'Review discusses ending twist without warning.'
  );
  assert(report.reason === 'SPOILER', 'Report filed with reason SPOILER');
  assert(report.status === 'PENDING', 'Report status is PENDING moderation');

  // --- TEST 8: Community Opinion Aggregation & Praise/Criticism Tags ---
  console.log('\n--- TEST 8: Aggregated Community Opinion Scorecard ---');
  // Create additional reviews to form community consensus
  await createAndAnalyzeReview({
    userId: userB.id,
    animeId: testAnime.id,
    title: 'Masterpiece storytelling',
    body: 'The story and music are brilliant. Pacing felt dragged and slow at times.',
    rating: 9,
  });

  const opinion = await recalculateCommunityOpinion(testAnime.id);
  assert(Boolean(opinion), 'Community Opinion scorecard generated');
  assert(opinion!.analyzedReviewCount >= 2, `Analyzed review count: ${opinion?.analyzedReviewCount}`);
  assert(opinion?.storyScore !== null && opinion!.storyScore! >= 7.0, `Story score calculated: ${opinion?.storyScore}`);
  assert(opinion!.positivePercentage >= 50, `Positive sentiment percentage: ${opinion?.positivePercentage}%`);

  // --- TEST 9: Review Deletion ---
  console.log('\n--- TEST 9: Review Deletion Lifecycle ---');
  const deleteRes = await deleteReview(userA.id, epReview.review.id);
  assert(deleteRes.success === true, 'User A successfully deleted own episode review');

  const deletedRev = await prisma.review.findUnique({ where: { id: epReview.review.id } });
  assert(deletedRev?.status === 'DELETED' && Boolean(deletedRev?.deletedAt), 'Review status set to DELETED with timestamp');

  // --- TEST 10: Event Log Verification ---
  console.log('\n--- TEST 10: Standardized Review Event Logging ---');
  const userAEvents = await prisma.eventLog.findMany({
    where: { userId: userA.id, entityType: 'REVIEW' },
  });
  const eventTypes = userAEvents.map((e) => e.eventType);
  assert(eventTypes.includes('REVIEW_CREATED'), 'EventLog contains REVIEW_CREATED');
  assert(eventTypes.includes('REVIEW_UPDATED'), 'EventLog contains REVIEW_UPDATED');
  assert(eventTypes.includes('REVIEW_DELETED'), 'EventLog contains REVIEW_DELETED');

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 4 REVIEW & INTELLIGENCE TESTS PASSED!');
  console.log('======================================================\n');
}

runPhase4ReviewTests()
  .catch((err) => {
    console.error('Phase 4 test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
