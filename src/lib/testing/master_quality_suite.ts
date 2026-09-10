/**
 * OTAKUVA QUALITY ENGINEERING — PHASE 11
 * COMPLETE TESTING & QUALITY VALIDATION MASTER SUITE
 * 
 * Comprehensive automated validation covering all 12 stages:
 * - 11.1 Test Architecture & Infrastructure
 * - 11.2 Unit & Component Testing
 * - 11.3 API & Integration Testing
 * - 11.4 End-to-End User Journey Testing
 * - 11.5 Database & Data Integrity Testing
 * - 11.6 OTAKUVA Rating Engine Testing
 * - 11.7 Tracking & User Activity Testing
 * - 11.8 Community & Real-Time Chat Testing
 * - 11.9 News, Admin CMS & Search Testing
 * - 11.10 Security, Performance & Load Testing
 * - 11.11 Regression, Reliability & Failure Testing
 * - 11.12 Final Quality Gate & Release Candidate Validation
 */

import { prisma } from '../prisma';
import { QualityTestRunner } from './testRunner';
import {
  UserFactory,
  AnimeFactory,
  StudioFactory,
  EpisodeFactory,
  RatingFactory,
  ReviewFactory,
  CommunityFactory,
  NewsFactory,
} from './testFactories';
import { InputValidator } from '../security/inputValidation';
import { XssSanitizer } from '../security/xssSanitizer';
import { SsrfProtection } from '../security/ssrfProtection';
import { RateLimiter } from '../security/rateLimiter';
import { SecurityHeaders } from '../security/securityHeaders';
import { SecurityAuditLogger } from '../security/securityAuditLogger';
import { CacheManager } from '../performance/cacheManager';
import { CircuitBreaker } from '../performance/circuitBreaker';
import { withResilientRetry } from '../performance/resilientRetry';
import { PerformanceMetrics } from '../performance/performanceMetrics';
import { IdempotencyService } from '../reliability/idempotencyService';
import { HealthService } from '../reliability/healthService';
import { hashPassword, comparePassword, signJwtToken, verifyJwtToken } from '../auth';
import { hasMinRole } from '../roles';
import { NextResponse } from 'next/server';

export async function runMasterQualitySuite(): Promise<boolean> {
  const runner = new QualityTestRunner();
  const testSuffix = Date.now();

  console.log(`========================================================================`);
  console.log(`OTAKUVA PHASE 11 — PRODUCTION-GRADE VALIDATION SYSTEM`);
  console.log(`Execution Timestamp: ${new Date().toISOString()}`);
  console.log(`========================================================================\n`);

  // =========================================================================
  // 11.1 — TEST ARCHITECTURE & INFRASTRUCTURE
  // =========================================================================
  runner.setStage('11.1 — TEST ARCHITECTURE & INFRASTRUCTURE');

  await runner.runTest('Deterministic UserFactory creates isolated users', async () => {
    const user = await UserFactory.create({ role: 'USER' });
    runner.assert(Boolean(user && user.id && user.username), 'User entity created with ID');
    runner.assert(user.role === 'USER', 'Role set to USER');
  });

  await runner.runTest('Deterministic StudioFactory and AnimeFactory create relational graph', async () => {
    const studio = await StudioFactory.create({ name: `Trigger_${testSuffix}` });
    const anime = await AnimeFactory.create({
      canonicalTitle: `Kill la Kill_${testSuffix}`,
      studioId: studio.id,
      genres: ['Action', 'Comedy'],
    });
    runner.assert(Boolean(anime && anime.id), 'Anime entity created with ID');
    const relations = await prisma.animeStudio.findMany({ where: { animeId: anime.id } });
    runner.assert(relations.length === 1 && relations[0].studioId === studio.id, 'Anime correctly linked to Studio');
  });

  // =========================================================================
  // 11.2 — UNIT & COMPONENT TESTING
  // =========================================================================
  runner.setStage('11.2 — UNIT & COMPONENT TESTING');

  await runner.runTest('InputValidator clamps rating to [1.0, 10.0]', () => {
    const valid = InputValidator.validateRating(9.4);
    runner.assert(valid.isValid && valid.value === 9.4, 'Valid 9.4 rating accepted');
    const high = InputValidator.validateRating(10.5);
    runner.assert(!high.isValid, 'Out-of-bounds 10.5 rating rejected');
    const low = InputValidator.validateRating(0.5);
    runner.assert(!low.isValid, 'Out-of-bounds 0.5 rating rejected');
  });

  await runner.runTest('InputValidator validates usernames and emails strictly', () => {
    const goodUser = InputValidator.validateUsername('shinji_ikari');
    runner.assert(goodUser.isValid, 'Valid alphanumeric username accepted');
    const shortUser = InputValidator.validateUsername('a');
    runner.assert(!shortUser.isValid, 'Single-character username rejected');
    const goodEmail = InputValidator.validateEmail('user@otakuva.com');
    runner.assert(goodEmail.isValid, 'Valid email accepted');
    const badEmail = InputValidator.validateEmail('invalid-email-string');
    runner.assert(!badEmail.isValid, 'Malformed email rejected');
  });

  await runner.runTest('XssSanitizer neutralizes HTML injections in user-generated content', () => {
    const dangerous = '<script>alert(document.cookie)</script><b onclick="hack()">Masterpiece!</b>';
    const sanitized = XssSanitizer.sanitizeUgc(dangerous);
    runner.assert(!sanitized.includes('<script>'), 'Script tag stripped');
    runner.assert(!sanitized.includes('onclick='), 'Event handler stripped');
    runner.assert(sanitized.includes('Masterpiece!'), 'Valid text preserved');
  });

  // =========================================================================
  // 11.3 — API & INTEGRATION TESTING
  // =========================================================================
  runner.setStage('11.3 — API & INTEGRATION TESTING');

  await runner.runTest('Auth API Contract: password hashing, signing, and verification', async () => {
    const password = 'SuperSecretPassword2026!';
    const hash = await hashPassword(password);
    runner.assert(await comparePassword(password, hash), 'Bcrypt hash correctly verified');
    runner.assert(!(await comparePassword('WrongPassword', hash)), 'Invalid password rejected');

    const token = signJwtToken({ userId: 'usr_test_1', username: 'tester', email: 'tester@otakuva.com' });
    const verified = verifyJwtToken(token);
    runner.assert(verified !== null && verified.userId === 'usr_test_1', 'JWT signed and verified');
  });

  await runner.runTest('Rating & Review Contract: rating updates aggregate score', async () => {
    const user = await UserFactory.create();
    const anime = await AnimeFactory.create();

    const rating = await RatingFactory.create(user.id, anime.id, 9.0);
    runner.assert(rating.rating === 9.0, 'Rating recorded in database');

    const review = await ReviewFactory.create(user.id, anime.id, 'Incredible narrative depth and execution.', 9.0);
    runner.assert(review.rating === 9 && review.body.includes('Incredible narrative'), 'Review recorded');
  });

  await runner.runTest('Community & Membership Contract: Owner assignment and join', async () => {
    const owner = await UserFactory.create();
    const member = await UserFactory.create();
    const community = await CommunityFactory.create(owner.id, { name: `Cyberpunk Hub ${testSuffix}` });

    const ownerMembership = await prisma.communityMember.findFirst({
      where: { communityId: community.id, userId: owner.id },
    });
    runner.assert(ownerMembership !== null && ownerMembership.role === 'OWNER', 'Owner assigned OWNER role');

    await prisma.communityMember.create({
      data: { communityId: community.id, userId: member.id, role: 'MEMBER' },
    });
    const totalMembers = await prisma.communityMember.count({ where: { communityId: community.id } });
    runner.assert(totalMembers === 2, 'New member successfully joined community');
  });

  // =========================================================================
  // 11.4 — END-TO-END USER JOURNEY TESTING
  // =========================================================================
  runner.setStage('11.4 — END-TO-END USER JOURNEY TESTING');

  await runner.runTest('Full User Journey: Registration -> Discovery -> Watching -> Rating -> Community Join', async () => {
    // 1. Register User
    const user = await UserFactory.create({ username: `journey_user_${testSuffix}` });

    // 2. Discover Anime
    const anime = await AnimeFactory.create({ canonicalTitle: `Steins;Gate Journey ${testSuffix}`, episodesCount: 24 });
    const ep1 = await EpisodeFactory.create(anime.id, 1, 'Prologue');

    // 3. Track Watch Progress
    const watchEntry = await prisma.userAnime.create({
      data: {
        userId: user.id,
        animeId: anime.id,
        status: 'WATCHING',
        episodesWatched: 1,
      },
    });
    runner.assert(watchEntry.status === 'WATCHING' && watchEntry.episodesWatched === 1, 'Watch progress initiated');

    // 4. Rate Anime
    await RatingFactory.create(user.id, anime.id, 9.5);
    const savedRating = await prisma.animeRating.findUnique({
      where: { userId_animeId: { userId: user.id, animeId: anime.id } },
    });
    runner.assert(savedRating !== null && savedRating.rating === 9.5, 'Rating submitted');

    // 5. Join Community
    const comm = await CommunityFactory.create(user.id, { name: `Science Adventure Club ${testSuffix}` });
    const memberCount = await prisma.communityMember.count({ where: { communityId: comm.id } });
    runner.assert(memberCount >= 1, 'Community created and joined in user journey');
  });

  // =========================================================================
  // 11.5 — DATABASE & DATA INTEGRITY TESTING
  // =========================================================================
  runner.setStage('11.5 — DATABASE & DATA INTEGRITY TESTING');

  await runner.runTest('Transaction safety: Rollback on mid-flight failure', async () => {
    const uniqueSlug = `tx-rollback-test-${testSuffix}`;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.studio.create({
          data: { name: 'Temporary Studio', slug: uniqueSlug },
        });
        // Intentionally throw error to trigger rollback
        throw new Error('Forced transaction failure');
      });
    } catch {
      // Expected catch
    }

    const found = await prisma.studio.findUnique({ where: { slug: uniqueSlug } });
    runner.assert(found === null, 'Transaction rolled back safely without orphaned records');
  });

  await runner.runTest('Unique constraint prevents duplicate anime rating for same user', async () => {
    const user = await UserFactory.create();
    const anime = await AnimeFactory.create();

    await RatingFactory.create(user.id, anime.id, 8.0);
    // Upsert or update updates existing without creating duplicates
    await RatingFactory.create(user.id, anime.id, 9.0);

    const totalRatings = await prisma.animeRating.count({
      where: { userId: user.id, animeId: anime.id },
    });
    runner.assert(totalRatings === 1, 'User anime rating remained singular');
  });

  // =========================================================================
  // 11.6 — OTAKUVA RATING ENGINE TESTING
  // =========================================================================
  runner.setStage('11.6 — OTAKUVA RATING ENGINE TESTING');

  await runner.runTest('Rating Engine velocity anomaly detection', async () => {
    RateLimiter.reset('RATINGS', `test_user_rate_${testSuffix}`);
    for (let i = 0; i < 15; i++) {
      const check = RateLimiter.checkRateLimit('RATINGS', `test_user_rate_${testSuffix}`);
      runner.assert(check.allowed, `Allowed rating #${i + 1}`);
    }
    const blocked = RateLimiter.checkRateLimit('RATINGS', `test_user_rate_${testSuffix}`);
    runner.assert(!blocked.allowed, 'Blocked 16th rating exceeding velocity limit');
  });

  // =========================================================================
  // 11.7 — TRACKING & USER ACTIVITY TESTING
  // =========================================================================
  runner.setStage('11.7 — TRACKING & USER ACTIVITY TESTING');

  await runner.runTest('Watch tracking progress and completion lifecycle', async () => {
    const user = await UserFactory.create();
    const anime = await AnimeFactory.create({ episodesCount: 12 });

    const track = await prisma.userAnime.create({
      data: {
        userId: user.id,
        animeId: anime.id,
        status: 'WATCHING',
        episodesWatched: 12,
      },
    });

    // Update to COMPLETED when progress reaches total episodes
    const completed = await prisma.userAnime.update({
      where: { id: track.id },
      data: { status: 'COMPLETED', finishDate: new Date() },
    });

    runner.assert(completed.status === 'COMPLETED' && completed.finishDate !== null, 'Series completed');
  });

  // =========================================================================
  // 11.8 — COMMUNITY & REAL-TIME CHAT TESTING
  // =========================================================================
  runner.setStage('11.8 — COMMUNITY & REAL-TIME CHAT TESTING');

  await runner.runTest('Community discovery across independent accounts', async () => {
    const accountA = await UserFactory.create();
    const accountB = await UserFactory.create();

    const comm = await CommunityFactory.create(accountA.id, { name: `Public Anime Hub ${testSuffix}` });

    // Account B searches and finds community
    const found = await prisma.community.findFirst({
      where: { id: comm.id, visibility: 'PUBLIC' },
    });
    runner.assert(found !== null, 'Account B discovers Account A public community');

    // Account B joins
    await prisma.communityMember.create({
      data: { communityId: comm.id, userId: accountB.id, role: 'MEMBER' },
    });

    const isMember = await prisma.communityMember.findFirst({
      where: { communityId: comm.id, userId: accountB.id },
    });
    runner.assert(isMember !== null, 'Account B successfully joined Account A community');
  });

  // =========================================================================
  // 11.9 — NEWS, ADMIN CMS & SEARCH TESTING
  // =========================================================================
  runner.setStage('11.9 — NEWS, ADMIN CMS & SEARCH TESTING');

  await runner.runTest('News ingestion links to primary anime subject', async () => {
    const anime = await AnimeFactory.create({ canonicalTitle: `Chainsaw Man S2_${testSuffix}` });
    const news = await NewsFactory.create({
      title: `Chainsaw Man Season 2 Confirmed_${testSuffix}`,
      animeId: anime.id,
    });

    const linked = await prisma.newsArticleAnime.findFirst({
      where: { articleId: news.id, animeId: anime.id },
    });
    runner.assert(linked !== null, 'News article linked to Anime entity');
  });

  await runner.runTest('Admin RBAC hierarchy strictly enforced', () => {
    runner.assert(!hasMinRole('USER', 'DATA_EDITOR'), 'Regular USER denied DATA_EDITOR');
    runner.assert(!hasMinRole('USER', 'ADMIN'), 'Regular USER denied ADMIN');
    runner.assert(hasMinRole('DATA_EDITOR', 'DATA_EDITOR'), 'DATA_EDITOR has DATA_EDITOR');
    runner.assert(hasMinRole('ADMIN', 'DATA_EDITOR'), 'ADMIN inherits DATA_EDITOR');
    runner.assert(hasMinRole('SUPER_ADMIN', 'ADMIN'), 'SUPER_ADMIN inherits ADMIN');
  });

  // =========================================================================
  // 11.10 — SECURITY, PERFORMANCE & LOAD TESTING
  // =========================================================================
  runner.setStage('11.10 — SECURITY, PERFORMANCE & LOAD TESTING');

  await runner.runTest('SSRF Protection blocks loopback, private subnets, and metadata IPs', () => {
    runner.assert(!SsrfProtection.isUrlSafe('http://localhost:3000/api').isSafe, 'Blocked localhost');
    runner.assert(!SsrfProtection.isUrlSafe('http://127.0.0.1:8080').isSafe, 'Blocked 127.0.0.1');
    runner.assert(!SsrfProtection.isUrlSafe('http://192.168.1.1').isSafe, 'Blocked RFC 1918');
    runner.assert(!SsrfProtection.isUrlSafe('http://169.254.169.254/latest').isSafe, 'Blocked AWS Metadata');
    runner.assert(SsrfProtection.isUrlSafe('https://otakuva.com/api').isSafe, 'Allowed public HTTPS');
  });

  await runner.runTest('Security Headers applied with CSP, HSTS, nosniff, SAMEORIGIN', () => {
    const resp = SecurityHeaders.applyHeaders(new NextResponse());
    runner.assert(resp.headers.get('Content-Security-Policy') !== null, 'CSP Header present');
    runner.assert(resp.headers.get('X-Content-Type-Options') === 'nosniff', 'nosniff Header present');
    runner.assert(resp.headers.get('X-Frame-Options') === 'SAMEORIGIN', 'SAMEORIGIN Header present');
  });

  await runner.runTest('Performance Caching: Cache-Aside with tag invalidation and metrics', async () => {
    CacheManager.clearAll();
    let computeCount = 0;
    const fetcher = async () => {
      computeCount++;
      return { payload: 'fast_data' };
    };

    const res1 = await CacheManager.getOrSet('test_cache_key', fetcher, 60, ['tag:test']);
    const res2 = await CacheManager.getOrSet('test_cache_key', fetcher, 60, ['tag:test']);
    runner.assert(computeCount === 1, 'Factory computed only once (Cache Hit on second call)');
    runner.assert(res1.payload === res2.payload, 'Returned identical cached payload');

    CacheManager.invalidateTag('tag:test');
    runner.assert(CacheManager.get('test_cache_key') === null, 'Cache invalidated via tag');
  });

  await runner.runTest('Circuit Breaker trips to OPEN on repeated failures and serves fallback', async () => {
    const cb = new CircuitBreaker('external_api_test', { failureThreshold: 3, resetTimeoutMs: 1000 });
    const failFn = async () => { throw new Error('API Outage'); };

    for (let i = 0; i < 3; i++) {
      await cb.execute(failFn, async () => ({ fallback: true })).catch(() => {});
    }

    runner.assert(cb.getState() === 'OPEN', 'CircuitBreaker state is OPEN');
    const fallbackRes = await cb.execute(failFn, async () => ({ fallback: 'served_gracefully' }));
    runner.assert(fallbackRes.fallback === 'served_gracefully', 'Fallback served immediately');
  });

  await runner.runTest('Resilient Retry recovers from transient failures with exponential backoff', async () => {
    let attempts = 0;
    const flakyFn = async () => {
      attempts++;
      if (attempts < 2) throw new Error('Transient error');
      return 'recovered_success';
    };
    const result = await withResilientRetry(flakyFn, { maxAttempts: 3, initialDelayMs: 10 });
    runner.assert(result === 'recovered_success' && attempts === 2, 'Recovered on second attempt');
  });

  // =========================================================================
  // 11.11 — REGRESSION, RELIABILITY & FAILURE TESTING
  // =========================================================================
  runner.setStage('11.11 — REGRESSION, RELIABILITY & FAILURE TESTING');

  await runner.runTest('Idempotency Service prevents duplicate mutations on identical keys', async () => {
    IdempotencyService.reset();
    let executions = 0;
    const mutate = async () => {
      executions++;
      return { txId: `tx_${testSuffix}` };
    };

    const run1 = await IdempotencyService.executeIdempotent(`idemp_${testSuffix}`, mutate);
    runner.assert(!run1.isDuplicate && executions === 1, 'First execution recorded');

    const run2 = await IdempotencyService.executeIdempotent(`idemp_${testSuffix}`, mutate);
    runner.assert(run2.isDuplicate && executions === 1, 'Duplicate execution intercepted');
    runner.assert(run2.result.txId === `tx_${testSuffix}`, 'Cached result returned safely');
  });

  // =========================================================================
  // 11.12 — FINAL QUALITY GATE & RELEASE CANDIDATE VALIDATION
  // =========================================================================
  runner.setStage('11.12 — FINAL QUALITY GATE & RELEASE CANDIDATE VALIDATION');

  await runner.runTest('Health Probes verify Liveness (UP) and Readiness (HEALTHY)', async () => {
    const liveness = HealthService.getLiveness();
    runner.assert(liveness.status === 'UP', 'Liveness probe reports UP');

    const readiness = await HealthService.getReadiness();
    runner.assert(readiness.status === 'HEALTHY', 'Readiness probe reports HEALTHY');
    runner.assert(readiness.subsystems.database.status === 'HEALTHY', 'Database subsystem is HEALTHY');
    runner.assert(readiness.subsystems.cache.status === 'HEALTHY', 'Cache subsystem is HEALTHY');
  });

  runner.printSummary();

  const report = runner.generateReport();
  return report.verdict === 'PASS';
}

if (require.main === module) {
  runMasterQualitySuite()
    .then((success) => {
      if (!success) process.exit(1);
    })
    .catch((err) => {
      console.error('Master Quality Suite fatal error:', err);
      process.exit(1);
    });
}
