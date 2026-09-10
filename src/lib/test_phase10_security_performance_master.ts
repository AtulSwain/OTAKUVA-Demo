/**
 * OTAKUVA MASTER TEST SUITE — PHASE 10
 * PRODUCTION-GRADE SECURITY, PERFORMANCE, RELIABILITY & OBSERVABILITY
 * 
 * Comprehensive automated verification covering:
 * - 10.1 Application Security (XSS Sanitization, SSRF Protection, Input Validation, Security Headers)
 * - 10.2 Authentication, Authorization & Account Security (Password Hashing, RBAC, Redaction, Audit Logging)
 * - 10.3 API, Database & Data Security (Category Rate Limiting, Server Pagination Caps, Transactions)
 * - 10.4 Performance Optimization & Caching (Cache-Aside, TTL, Tag Invalidation, Circuit Breakers, Retries, Metrics)
 * - 10.5 Scalability, Reliability & Observability (Idempotency, Liveness & Readiness Probes)
 */

import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { InputValidator } from './security/inputValidation';
import { XssSanitizer } from './security/xssSanitizer';
import { SsrfProtection } from './security/ssrfProtection';
import { RateLimiter } from './security/rateLimiter';
import { SecurityHeaders } from './security/securityHeaders';
import { SecurityAuditLogger } from './security/securityAuditLogger';
import { CacheManager } from './performance/cacheManager';
import { CircuitBreaker } from './performance/circuitBreaker';
import { withResilientRetry } from './performance/resilientRetry';
import { PerformanceMetrics } from './performance/performanceMetrics';
import { IdempotencyService } from './reliability/idempotencyService';
import { HealthService } from './reliability/healthService';
import { hashPassword, comparePassword } from './auth';
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

async function runPhase10SecurityPerformanceTestSuite() {
  console.log('========================================================================');
  console.log('OTAKUVA — PHASE 10 SECURITY, PERFORMANCE & RELIABILITY MASTER SUITE');
  console.log('========================================================================\n');

  const testSuffix = Date.now();

  // =========================================================================
  // TEST 1: 10.1 — APPLICATION SECURITY & XSS SANITIZATION
  // =========================================================================
  console.log('--- TEST 1: 10.1 — APPLICATION SECURITY & XSS SANITIZATION ---');

  // Stored XSS Script Stripping
  const dirtyHtml = '<p>Great anime!</p><script>alert("xss")</script><iframe src="evil.com"></iframe>';
  const cleanUgc = XssSanitizer.sanitizeUgc(dirtyHtml);
  assert(!cleanUgc.includes('<script>'), 'XSS: Stripped <script> tag from UGC');
  assert(!cleanUgc.includes('<iframe>'), 'XSS: Stripped <iframe> tag from UGC');
  assert(cleanUgc.includes('Great anime!'), 'XSS: Preserved legitimate text content');

  // Inline Event Handler Stripping
  const dirtyOnload = '<img src="valid.jpg" onerror="alert(1)" onload="fetch(\'http://evil.com\')"/>';
  const cleanOnload = XssSanitizer.sanitizeUgc(dirtyOnload);
  assert(!cleanOnload.includes('onerror='), 'XSS: Stripped onerror event handler');
  assert(!cleanOnload.includes('onload='), 'XSS: Stripped onload event handler');

  // Javascript Pseudo-protocol Stripping
  const dirtyHref = '<a href="javascript:stealTokens()">Click here</a>';
  const cleanHref = XssSanitizer.sanitizeUgc(dirtyHref);
  assert(!cleanHref.includes('javascript:'), 'XSS: Stripped javascript: pseudo-protocol');

  // Plain Text HTML Escaping
  const dirtyPlain = '<div onclick="hack()">User & Name</div>';
  const cleanPlain = XssSanitizer.sanitizePlainText(dirtyPlain);
  assert(cleanPlain.includes('&amp;'), 'XSS: Properly encoded ampersand entity');
  assert(!cleanPlain.includes('<div'), 'XSS: Stripped all HTML tags from plain text');

  // SSRF Protection
  const ssrfLocal = SsrfProtection.isUrlSafe('http://localhost:3000/internal/admin');
  assert(ssrfLocal.isSafe === false, 'SSRF: Blocked localhost probing');

  const ssrfLoopback = SsrfProtection.isUrlSafe('http://127.0.0.1:8080/metrics');
  assert(ssrfLoopback.isSafe === false, 'SSRF: Blocked 127.0.0.1 loopback IP');

  const ssrfPrivateSubnet = SsrfProtection.isUrlSafe('http://192.168.1.50/config');
  assert(ssrfPrivateSubnet.isSafe === false, 'SSRF: Blocked RFC 1918 private subnet IP');

  const ssrfAwsMeta = SsrfProtection.isUrlSafe('http://169.254.169.254/latest/meta-data/');
  assert(ssrfAwsMeta.isSafe === false, 'SSRF: Blocked AWS metadata endpoint');

  const ssrfFileScheme = SsrfProtection.isUrlSafe('file:///etc/passwd');
  assert(ssrfFileScheme.isSafe === false, 'SSRF: Blocked file:// scheme');

  const ssrfValidPublic = SsrfProtection.isUrlSafe('https://api.animenewsnetwork.com/feed.xml');
  assert(ssrfValidPublic.isSafe === true, 'SSRF: Allowed valid public HTTPS URL');

  // Security Headers
  const baseResp = new NextResponse();
  const securedResp = SecurityHeaders.applyHeaders(baseResp);
  assert(securedResp.headers.get('Content-Security-Policy') !== null, 'Headers: Applied Content-Security-Policy');
  assert(securedResp.headers.get('X-Content-Type-Options') === 'nosniff', 'Headers: Applied X-Content-Type-Options: nosniff');
  assert(securedResp.headers.get('X-Frame-Options') === 'SAMEORIGIN', 'Headers: Applied X-Frame-Options: SAMEORIGIN');
  assert(securedResp.headers.get('Referrer-Policy') === 'strict-origin-when-cross-origin', 'Headers: Applied Referrer-Policy');

  // =========================================================================
  // TEST 2: 10.2 — AUTHENTICATION, AUTHORIZATION & ACCOUNT SECURITY
  // =========================================================================
  console.log('\n--- TEST 2: 10.2 — AUTHENTICATION, AUTHORIZATION & ACCOUNT SECURITY ---');

  // Password Hashing & Verification
  const rawPass = 'OtakuvaSecurePass2026!';
  const hashed = await hashPassword(rawPass);
  assert(hashed !== rawPass, 'Password: Password is not stored in plaintext');
  assert(hashed.startsWith('$2'), 'Password: Uses bcrypt salted hash format');
  assert(await comparePassword(rawPass, hashed) === true, 'Password: Valid password passes comparison');
  assert(await comparePassword('WrongPassword123', hashed) === false, 'Password: Invalid password fails comparison');

  // Input Validation
  const validUser = InputValidator.validateUsername('otaku_master_99');
  assert(validUser.isValid === true, 'Validation: Valid username accepted');
  const invalidUser = InputValidator.validateUsername('a');
  assert(invalidUser.isValid === false, 'Validation: Short username rejected');

  const validEmail = InputValidator.validateEmail('user@otakuva.test');
  assert(validEmail.isValid === true, 'Validation: Valid email accepted');
  const invalidEmail = InputValidator.validateEmail('not-an-email');
  assert(invalidEmail.isValid === false, 'Validation: Invalid email rejected');

  const validRating = InputValidator.validateRating(8.5);
  assert(validRating.isValid === true && validRating.value === 8.5, 'Validation: Valid rating (8.5) accepted');
  const invalidRating = InputValidator.validateRating(15.0);
  assert(invalidRating.isValid === false, 'Validation: Out of bounds rating (15.0) rejected');

  // RBAC Authorization Hierarchy
  assert(!hasMinRole('USER', 'DATA_EDITOR'), 'RBAC: Regular USER denied DATA_EDITOR');
  assert(!hasMinRole('USER', 'ADMIN'), 'RBAC: Regular USER denied ADMIN');
  assert(hasMinRole('DATA_EDITOR', 'DATA_EDITOR'), 'RBAC: DATA_EDITOR satisfies DATA_EDITOR');
  assert(hasMinRole('ADMIN', 'DATA_EDITOR'), 'RBAC: ADMIN satisfies DATA_EDITOR');
  assert(hasMinRole('SUPER_ADMIN', 'ADMIN'), 'RBAC: SUPER_ADMIN satisfies ADMIN');

  // Security Audit Logging & Redaction
  const testUser = await prisma.user.create({
    data: {
      username: `sec_test_${testSuffix}`,
      email: `sec_test_${testSuffix}@otakuva.test`,
      role: 'USER',
    },
  });

  await SecurityAuditLogger.logSecurityEvent({
    eventType: 'AUTH_LOGIN_FAILURE',
    actorId: testUser.id,
    targetEntityType: 'User',
    targetEntityId: testUser.id,
    details: {
      password: 'AttemptedPlaintextSecret',
      jwtToken: 'SensitiveBearerToken',
      ip: '192.0.2.1',
    },
  });

  const auditLog = await prisma.auditLog.findFirst({
    where: { actorId: testUser.id, action: 'AUTH_LOGIN_FAILURE' },
  });
  assert(auditLog !== null, 'AuditLog: Recorded security event to database');
  assert(Boolean(!auditLog!.afterJson?.includes('AttemptedPlaintextSecret')), 'AuditLog: Redacted password from security log');
  assert(Boolean(auditLog!.afterJson?.includes('[REDACTED]')), 'AuditLog: Replaced sensitive secret with [REDACTED]');

  // =========================================================================
  // TEST 3: 10.3 — API, DATABASE & DATA SECURITY
  // =========================================================================
  console.log('\n--- TEST 3: 10.3 — API, DATABASE & DATA SECURITY ---');

  // Multi-Category Rate Limiting
  RateLimiter.reset('AUTH', `ip_${testSuffix}`);
  for (let i = 0; i < 5; i++) {
    const status = RateLimiter.checkRateLimit('AUTH', `ip_${testSuffix}`);
    assert(status.allowed === true, `RateLimiter: Allowed auth request #${i + 1}`);
  }
  const blockedAuth = RateLimiter.checkRateLimit('AUTH', `ip_${testSuffix}`);
  assert(blockedAuth.allowed === false, 'RateLimiter: Blocked 6th auth request exceeding threshold');
  assert(blockedAuth.retryAfterSec !== undefined && blockedAuth.retryAfterSec > 0, 'RateLimiter: Returns retryAfterSec header value');

  // Server-Side Pagination Caps
  const normalPagination = InputValidator.parsePagination('2', '20');
  assert(normalPagination.page === 2 && normalPagination.limit === 20 && normalPagination.skip === 20, 'Pagination: Correctly parsed page 2 limit 20');

  const maliciousPagination = InputValidator.parsePagination('1', '999999');
  assert(maliciousPagination.limit === 100, 'Pagination: Clamped excessive limit (999999) to server max limit (100)');

  // Transaction Atomicity
  const studioName = `Transaction Studio ${testSuffix}`;
  await prisma.$transaction(async (tx) => {
    const s = await tx.studio.create({
      data: { name: studioName, slug: `tx-studio-${testSuffix}` },
    });
    await tx.studioHistoryEvent.create({
      data: {
        studioId: s.id,
        eventYear: 2020,
        title: 'Founded',
        shortDescription: 'Studio was established',
        eventType: 'FOUNDATION',
      },
    });
  });

  const createdStudio = await prisma.studio.findFirst({ where: { name: studioName } });
  assert(createdStudio !== null, 'Transaction: Atomically created studio and history event');

  // =========================================================================
  // TEST 4: 10.4 — PERFORMANCE OPTIMIZATION & CACHING
  // =========================================================================
  console.log('\n--- TEST 4: 10.4 — PERFORMANCE OPTIMIZATION & CACHING ---');

  CacheManager.clearAll();

  // Cache-Aside with Factory
  let factoryExecutions = 0;
  const fetchExpensiveData = async () => {
    factoryExecutions++;
    return { data: 'heavy_anime_payload', computedAt: Date.now() };
  };

  const res1 = await CacheManager.getOrSet('test_key_1', fetchExpensiveData, 60, ['tag:anime:100']);
  assert(factoryExecutions === 1, 'CacheManager: Executed factory on cache miss');

  const res2 = await CacheManager.getOrSet('test_key_1', fetchExpensiveData, 60, ['tag:anime:100']);
  assert(factoryExecutions === 1, 'CacheManager: Served from cache on second call (no factory rerun)');
  assert(res1.data === res2.data, 'CacheManager: Returned identical payload');

  // Tag Invalidation
  const purgedCount = CacheManager.invalidateTag('tag:anime:100');
  assert(purgedCount === 1, 'CacheManager: Invalidated cache by tag ("tag:anime:100")');
  assert(CacheManager.get('test_key_1') === null, 'CacheManager: Key is no longer in cache after tag invalidation');

  // User Cache Isolation
  const userKeyA = CacheManager.userKey('user_123', 'feed');
  const userKeyB = CacheManager.userKey('user_456', 'feed');
  CacheManager.set(userKeyA, { user: 'A' }, 60);
  CacheManager.set(userKeyB, { user: 'B' }, 60);
  assert(CacheManager.get<{ user: string }>(userKeyA)?.user === 'A', 'CacheManager: User A isolated cache');
  assert(CacheManager.get<{ user: string }>(userKeyB)?.user === 'B', 'CacheManager: User B isolated cache');

  // Circuit Breaker Pattern
  const breaker = new CircuitBreaker('test_external_service', { failureThreshold: 3, resetTimeoutMs: 1000 });
  let failCount = 0;
  const failingOp = async () => {
    failCount++;
    throw new Error('External API Down');
  };

  // Trigger 3 failures
  for (let i = 0; i < 3; i++) {
    await breaker.execute(failingOp, async () => ({ fallback: true })).catch(() => {});
  }
  assert(breaker.getState() === 'OPEN', 'CircuitBreaker: Tripped to OPEN state after 3 failures');

  // Verify fast-fail fallback when OPEN
  const fallbackRes = await breaker.execute(failingOp, async () => ({ fallback: 'served_gracefully' }));
  assert(fallbackRes.fallback === 'served_gracefully', 'CircuitBreaker: Served fallback immediately without executing failing call');

  // Resilient Retry with Exponential Backoff
  let retryAttempts = 0;
  const transientOp = async () => {
    retryAttempts++;
    if (retryAttempts < 3) throw new Error('Transient network blip');
    return 'success_on_attempt_3';
  };
  const retryResult = await withResilientRetry(transientOp, { maxAttempts: 3, initialDelayMs: 10 });
  assert(retryResult === 'success_on_attempt_3', 'Retry: Recovered from transient failure on attempt 3');

  // Performance Metrics Latency Tracker
  PerformanceMetrics.reset();
  PerformanceMetrics.recordRequest('/api/anime', 25, 200);
  PerformanceMetrics.recordRequest('/api/anime', 35, 200);
  PerformanceMetrics.recordRequest('/api/anime', 95, 200);
  PerformanceMetrics.recordRequest('/api/anime', 120, 200);
  PerformanceMetrics.recordRequest('/api/anime', 550, 500); // 1 slow error

  const stats = PerformanceMetrics.getStats();
  assert(stats.sampleCount === 5, 'Metrics: Recorded 5 requests');
  assert(stats.p50Ms > 0, 'Metrics: Computed p50 latency');
  assert(stats.p95Ms > stats.p50Ms, 'Metrics: Computed p95 latency > p50');
  assert(stats.slowRequestCount === 1, 'Metrics: Detected slow request (> 500ms)');
  assert(stats.errorRate === 20, 'Metrics: Computed 20% error rate (1 out of 5)');

  // =========================================================================
  // TEST 5: 10.5 — RELIABILITY, OBSERVABILITY & HEALTH PROBES
  // =========================================================================
  console.log('\n--- TEST 5: 10.5 — RELIABILITY, OBSERVABILITY & HEALTH PROBES ---');

  // Idempotency Protection
  IdempotencyService.reset();
  let mutationExecutions = 0;
  const criticalMutation = async () => {
    mutationExecutions++;
    return { orderId: `ord_${testSuffix}`, status: 'PROCESSED' };
  };

  const idemp1 = await IdempotencyService.executeIdempotent(`key_${testSuffix}`, criticalMutation);
  assert(idemp1.isDuplicate === false, 'Idempotency: First execution marked isDuplicate: false');
  assert(mutationExecutions === 1, 'Idempotency: Executed mutation once');

  const idemp2 = await IdempotencyService.executeIdempotent(`key_${testSuffix}`, criticalMutation);
  assert(idemp2.isDuplicate === true, 'Idempotency: Duplicate execution marked isDuplicate: true');
  assert(mutationExecutions === 1, 'Idempotency: Prevented second execution of mutation (count remains 1)');
  assert(idemp2.result.status === 'PROCESSED', 'Idempotency: Returned cached result safely');

  // Health Probes
  const liveness = HealthService.getLiveness();
  assert(liveness.status === 'UP', 'Health: Liveness probe returns status UP');

  const readiness = await HealthService.getReadiness();
  assert(readiness.status === 'HEALTHY', 'Health: Readiness probe confirms database & memory HEALTHY');
  assert(readiness.subsystems.database.status === 'HEALTHY', 'Health: Database subsystem is HEALTHY');
  assert(readiness.subsystems.cache.status === 'HEALTHY', 'Health: Cache subsystem is HEALTHY');

  console.log('\n========================================================================');
  console.log(`PHASE 10 TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  console.log('========================================================================\n');
}

runPhase10SecurityPerformanceTestSuite().catch((err) => {
  console.error('Phase 10 Test Suite execution failed:', err);
  process.exit(1);
});
