/**
 * OTAKUVA MASTER TEST SUITE — PHASES 11.1 → 11.5
 * ADVANCED AI / ML INTELLIGENCE LAYER
 * 
 * Comprehensive automated verification covering:
 * - 11.1: Semantic Intelligence & Embedding Engine (L2-vectors, Cosine, Versioning, Semantic Search)
 * - 11.2: Intelligent Review Understanding (Aspect Extraction, Sentiment, Sample Protection, Immutability)
 * - 11.3: Advanced Hybrid Recommendation Model (Multi-score, Quality separation, Diversity)
 * - 11.4: User & Anime Representation Learning (Multi-cluster, 3-Layer Intent, Signal Weighting)
 * - 11.5: Predictive Personalization Intelligence (P(Start), P(Complete), Model Registry, Rollback)
 * - Security & RBAC Enforcement
 */

import { prisma } from './prisma';
import { embeddingEngine, DeterministicSemanticProvider } from './engine/ai/embeddingEngine';
import { reviewIntelligenceService } from './engine/ai/reviewIntelligenceService';
import { hybridRecommendationModel } from './engine/ai/hybridRecommendationModel';
import { representationLearningEngine } from './engine/ai/representationLearningEngine';
import { predictivePersonalizationEngine } from './engine/ai/predictivePersonalizationEngine';
import { tasteEngine } from './engine/taste/tasteEngine';
import { hasMinRole } from './roles';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase11TestSuite() {
  console.log('========================================================================');
  console.log('OTAKUVA ENGINE — PHASES 11.1 → 11.5 ADVANCED AI/ML INTELLIGENCE SUITE');
  console.log('========================================================================\n');

  const testSuffix = Date.now();

  // Setup Test Users
  const userA = await prisma.user.create({
    data: {
      username: `ai_user_a_${testSuffix}`,
      email: `ai_user_a_${testSuffix}@otakuva.test`,
      role: 'USER',
    },
  });

  const userB = await prisma.user.create({
    data: {
      username: `ai_user_b_${testSuffix}`,
      email: `ai_user_b_${testSuffix}@otakuva.test`,
      role: 'USER',
    },
  });

  // Setup Genres
  const genrePsychological = await prisma.genre.upsert({
    where: { name: 'Psychological' },
    create: { name: 'Psychological', slug: 'psychological' },
    update: {},
  });
  const genreMystery = await prisma.genre.upsert({
    where: { name: 'Mystery' },
    create: { name: 'Mystery', slug: 'mystery' },
    update: {},
  });
  const genreComedy = await prisma.genre.upsert({
    where: { name: 'Comedy' },
    create: { name: 'Comedy', slug: 'comedy' },
    update: {},
  });

  // Setup Studio
  const studioMappa = await prisma.studio.create({
    data: {
      name: `MAPPA AI Intelligence ${testSuffix}`,
      slug: `mappa-ai-intel-${testSuffix}`,
      foundedYear: 2011,
    },
  });

  // Setup Anime
  const animePsych = await prisma.anime.create({
    data: {
      canonicalTitle: `Mind Paradox ${testSuffix}`,
      slug: `mind-paradox-${testSuffix}`,
      synopsis: 'A detective with fractured memories unravels a deep psychological mystery in Tokyo.',
      posterUrl: 'https://example.com/mind.jpg',
      type: 'TV',
      episodes: 12,
      score: 8.9,
      year: 2023,
      animeGenres: { create: [{ genreId: genrePsychological.id }, { genreId: genreMystery.id }] },
      animeStudios: { create: [{ studioId: studioMappa.id, isPrimary: true }] },
    },
  });

  const animeComedy = await prisma.anime.create({
    data: {
      canonicalTitle: `Daily Laughs ${testSuffix}`,
      slug: `daily-laughs-${testSuffix}`,
      synopsis: 'High school students encounter hilarious everyday situations and witty misunderstandings.',
      posterUrl: 'https://example.com/laughs.jpg',
      type: 'TV',
      episodes: 24,
      score: 8.1,
      year: 2022,
      animeGenres: { create: [{ genreId: genreComedy.id }] },
    },
  });

  // Seed Ratings & Library for User A
  await prisma.animeRating.create({
    data: {
      userId: userA.id,
      animeId: animePsych.id,
      rating: 9.5,
    },
  });

  await prisma.userAnime.create({
    data: {
      userId: userA.id,
      animeId: animePsych.id,
      status: 'COMPLETED',
      episodesWatched: 12,
    },
  });

  // Seed Taste Profile
  await tasteEngine.rebuildTasteProfile(userA.id);

  // =========================================================================
  // TEST 1: 11.1 — SEMANTIC INTELLIGENCE & EMBEDDING ENGINE
  // =========================================================================
  console.log('--- TEST 1: 11.1 — SEMANTIC INTELLIGENCE & EMBEDDING ENGINE ---');

  const provider = new DeterministicSemanticProvider();
  const info = provider.getModelInfo();
  assert(info.dimension === 64, 'Embedding dimension is 64D');
  assert(info.modelName === 'otakuva-semantic-v1', 'Embedding model name matches specification');

  // Vector Generation & Normalization
  const sampleDoc = 'Dark psychological thriller mystery';
  const vector = await provider.generateEmbedding(sampleDoc);
  assert(vector.length === 64, 'Generated vector has exact length 64');

  const validation = provider.validateEmbedding(vector);
  assert(validation.isValid === true, 'Generated vector passed strict validation');

  // Cosine Similarity
  const vectorSame = await provider.generateEmbedding(sampleDoc);
  const cosSame = embeddingEngine.computeCosineSimilarity(vector, vectorSame);
  assert(cosSame >= 0.99, `Cosine similarity of identical document is ~1.0 (got ${cosSame})`);

  const vectorDiff = await provider.generateEmbedding('Cute wholesome slapstick comedy everyday life');
  const cosDiff = embeddingEngine.computeCosineSimilarity(vector, vectorDiff);
  assert(cosDiff < cosSame, `Distinct semantic content has lower cosine similarity (got ${cosDiff} < ${cosSame})`);

  // Vector Persistence & Indexing
  const saveRes = await embeddingEngine.generateAndSaveAnimeEmbedding(animePsych.id);
  assert(saveRes.success === true, 'Saved anime embedding into EntityEmbedding table');

  const savedVec = await embeddingEngine.getEntityEmbedding('ANIME', animePsych.id);
  assert(savedVec !== null && savedVec.length === 64, 'Retrieved saved vector from EntityEmbedding table');

  // Semantic Search
  await embeddingEngine.generateAndSaveAnimeEmbedding(animeComedy.id);
  const searchRes = await embeddingEngine.searchSemantically('detective memory puzzle mystery', { limit: 5 });
  assert(searchRes.results.length >= 1, 'Semantic search returned matched entities');
  assert(searchRes.results[0].anime.canonicalTitle.includes('Mind Paradox'), 'Semantic search correctly ranked Mind Paradox #1');
  assert(searchRes.results[0].semanticExplanation.length > 0, 'Includes human-readable semantic explanation');

  // =========================================================================
  // TEST 2: 11.2 — INTELLIGENT REVIEW UNDERSTANDING
  // =========================================================================
  console.log('\n--- TEST 2: 11.2 — INTELLIGENT REVIEW UNDERSTANDING ---');

  // Create Original User Review
  const rev1 = await prisma.review.create({
    data: {
      userId: userA.id,
      animeId: animePsych.id,
      title: 'A true psychological masterpiece',
      body: 'I loved the characters and the complex story writing! However, the pacing felt a bit slow in episode 4.',
      rating: 9,
    },
  });

  const analysisRes = await reviewIntelligenceService.processAndSaveReviewAnalysis(rev1.id);
  assert(analysisRes !== null, 'NLP review analysis processed successfully');
  assert(analysisRes!.overallSentiment === 'POSITIVE', 'Overall sentiment classified as POSITIVE');

  // Fine-grained Aspects Check
  const charAspect = analysisRes!.aspects.find((a) => a.aspect === 'CHARACTERS');
  assert(charAspect !== undefined, 'Extracted CHARACTERS aspect');
  assert(charAspect!.sentiment === 'POSITIVE', 'CHARACTERS sentiment is POSITIVE');

  const storyAspect = analysisRes!.aspects.find((a) => a.aspect === 'STORY');
  assert(storyAspect !== undefined, 'Extracted STORY aspect');
  assert(storyAspect!.sentiment === 'POSITIVE', 'STORY sentiment is POSITIVE');

  const pacingAspect = analysisRes!.aspects.find((a) => a.aspect === 'PACING');
  assert(pacingAspect !== undefined, 'Extracted PACING aspect');
  assert(pacingAspect!.sentiment === 'NEGATIVE', 'PACING sentiment is NEGATIVE');

  // Immutability Check: Original review is untouched
  const originalReview = await prisma.review.findUnique({ where: { id: rev1.id } });
  assert(originalReview!.rating === 9, 'Original user rating (9/10) strictly preserved');
  assert(originalReview!.body.includes('loved the characters'), 'Original review body completely untouched');

  // Sample Size Protection (< 3 reviews)
  const aggEarly = await reviewIntelligenceService.getAnimeAggregatedReviewIntelligence(animePsych.id);
  assert(aggEarly.hasSufficientData === false, 'Aggregated intelligence protects against small sample (< 3 reviews)');

  // Add 2 more reviews to satisfy minimum threshold
  const rev2 = await prisma.review.create({
    data: {
      userId: userB.id,
      animeId: animePsych.id,
      title: 'Incredible directing and cast',
      body: 'The character development is stellar. Beautiful art and memorable writing.',
      rating: 10,
    },
  });
  await reviewIntelligenceService.processAndSaveReviewAnalysis(rev2.id);

  const rev3 = await prisma.review.create({
    data: {
      userId: userA.id,
      animeId: animePsych.id,
      title: 'Great story despite slow moments',
      body: 'Compelling plot and deep lore. The pacing drags slightly.',
      rating: 8,
    },
  });
  await reviewIntelligenceService.processAndSaveReviewAnalysis(rev3.id);

  const aggMature = await reviewIntelligenceService.getAnimeAggregatedReviewIntelligence(animePsych.id);
  assert(aggMature.hasSufficientData === true, 'Aggregated intelligence activated with sufficient reviews (>= 3)');
  assert(aggMature.aspectDistribution['CHARACTERS']?.positivePercentage >= 75, 'Aggregated high positive sentiment for CHARACTERS');

  // =========================================================================
  // TEST 3: 11.3 — ADVANCED HYBRID RECOMMENDATION MODEL
  // =========================================================================
  console.log('\n--- TEST 3: 11.3 — ADVANCED HYBRID RECOMMENDATION MODEL ---');

  const hybridResult = await hybridRecommendationModel.getHybridRecommendations(userA.id, { limit: 5 });
  assert(hybridResult.modelVersion === 'v1.1', 'Returns hybrid model version v1.1');
  assert(hybridResult.items.length >= 1, 'Returns ranked hybrid recommendations');

  const topItem = hybridResult.items[0];
  assert(topItem.finalScore > 0, 'Computed final composite score');
  assert(topItem.breakdown.semanticScore >= 0, 'Includes semantic score breakdown');
  assert(topItem.breakdown.modelScore >= 0, 'Includes model score breakdown');
  assert(topItem.breakdown.qualityScore >= 0, 'Includes quality score breakdown');
  assert(topItem.structuredExplanation.reasonType.length > 0, 'Includes structured explanation metadata');

  // Fallback Check for guest
  const guestHybrid = await hybridRecommendationModel.getHybridRecommendations(null, { limit: 4 });
  assert(guestHybrid.items.length >= 1, 'Guest received recommendations via graceful fallback');

  // =========================================================================
  // TEST 4: 11.4 — USER & ANIME REPRESENTATION LEARNING
  // =========================================================================
  console.log('\n--- TEST 4: 11.4 — USER & ANIME REPRESENTATION LEARNING ---');

  const userRep = await representationLearningEngine.learnUserRepresentation(userA.id, ['dark psychological detective']);
  assert(userRep.representationVersion === 1, 'Learned representation version 1');
  assert(userRep.longTermTasteVector.length === 64, 'Long-term taste vector generated (64D)');
  assert(userRep.sessionIntentVector !== undefined && userRep.sessionIntentVector.length === 64, 'Session intent vector generated (64D)');
  assert(userRep.signalsSummary.completionsCount === 1, 'Accurately tracked completion count signal (1)');
  assert(userRep.topAffinityEntities.genres.some((g) => g.name === 'Psychological'), 'Identified Psychological in top affinity genres');

  // Interest Clusters Check
  const clustersInDb = await prisma.userInterestCluster.findMany({ where: { userId: userA.id } });
  assert(clustersInDb.length >= 1, 'Persisted user interest clusters to database');
  assert(
    clustersInDb[0].clusterLabel.includes('Psychological') || clustersInDb[0].clusterLabel.includes('Mystery'),
    'Cluster label reflects primary genre cluster'
  );

  // =========================================================================
  // TEST 5: 11.5 — PREDICTIVE PERSONALIZATION INTELLIGENCE
  // =========================================================================
  console.log('\n--- TEST 5: 11.5 — PREDICTIVE PERSONALIZATION INTELLIGENCE ---');

  // Start Probability Prediction
  const startPred = await predictivePersonalizationEngine.predictStartProbability(userA.id, animePsych.id);
  assert(startPred.probability >= 0.0 && startPred.probability <= 1.0, `Start probability is bounded in [0.0, 1.0] (got ${startPred.probability})`);
  assert(startPred.probability > 0.5, 'High start probability for loved genre/studio');

  // Completion Probability Prediction
  const completePred = await predictivePersonalizationEngine.predictCompletionProbability(userA.id, animePsych.id);
  assert(completePred.probability >= 0.0 && completePred.probability <= 1.0, `Completion probability is bounded in [0.0, 1.0] (got ${completePred.probability})`);

  // Model Registry
  const registered = await predictivePersonalizationEngine.registerModel({
    modelName: 'hybrid-ranking-model',
    modelVersion: 'v1.1',
    taskType: 'RANKING',
    status: 'PRODUCTION',
    featureVersion: 'v1',
    trafficPercentage: 100,
    metrics: { precision: 0.86, recall: 0.81, ndcg: 0.89 },
  });
  assert(registered.status === 'PRODUCTION', 'Registered production model in ModelRegistry');

  // Model Rollback Test
  await predictivePersonalizationEngine.registerModel({
    modelName: 'hybrid-ranking-model',
    modelVersion: 'v1.0',
    taskType: 'RANKING',
    status: 'READY',
    featureVersion: 'v1',
    trafficPercentage: 0,
    metrics: { precision: 0.82, recall: 0.78, ndcg: 0.84 },
  });

  const rollbackRes = await predictivePersonalizationEngine.rollbackModel('hybrid-ranking-model', 'v1.0');
  assert(rollbackRes.success === true, 'Successfully executed reversible model rollback');

  const activeModel = await prisma.modelRegistry.findUnique({
    where: { modelName_modelVersion: { modelName: 'hybrid-ranking-model', modelVersion: 'v1.0' } },
  });
  assert(activeModel?.status === 'PRODUCTION', 'Rolled back model version promoted to PRODUCTION');

  // =========================================================================
  // TEST 6: SECURITY & RBAC ENFORCEMENT
  // =========================================================================
  console.log('\n--- TEST 6: SECURITY & RBAC ENFORCEMENT ---');

  assert(!hasMinRole('USER', 'DATA_EDITOR'), 'RBAC: Regular USER denied DATA_EDITOR role');
  assert(!hasMinRole('USER', 'ADMIN'), 'RBAC: Regular USER denied ADMIN role');
  assert(hasMinRole('ADMIN', 'DATA_EDITOR'), 'RBAC: ADMIN inherits DATA_EDITOR role');

  console.log('\n========================================================================');
  console.log(`PHASE 11 TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  console.log('========================================================================\n');
}

runPhase11TestSuite().catch((err) => {
  console.error('Phase 11 Test Suite execution failed:', err);
  process.exit(1);
});
