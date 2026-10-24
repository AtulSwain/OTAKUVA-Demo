# OTAKUVA — Production System Architecture Specification

## 1. Executive Summary
OTAKUVA is a high-performance Anime intelligence, catalog discovery, social community, and personalization platform. The architecture is engineered for low-latency delivery, high resilience against cascading outages, strict data consistency, and continuous observability.

---

## 2. Production Topology

```
                   ┌────────────────────┐
                   │      USERS         │
                   └─────────┬──────────┘
                             │
                             ▼
                   ┌────────────────────┐
                   │   DNS / CDN / WAF  │
                   └─────────┬──────────┘
                             │
                     HTTPS / TLS
                             │
                             ▼
              ┌────────────────────────────┐
              │      OTAKUVA FRONTEND      │
              │     (Next.js App Router)   │
              └─────────────┬──────────────┘
                            │
                            ▼
              ┌────────────────────────────┐
              │       OTAKUVA API          │
              │  (Next.js API Handlers)    │
              └─────────────┬──────────────┘
                            │
      ┌─────────────────────┼─────────────────────┐
      │                     │                     │
      ▼                     ▼                     ▼
┌───────────┐        ┌──────────────┐      ┌────────────┐
│   CACHE   │        │   DATABASE   │      │   SEARCH   │
│ (Cache-   │        │  (PostgreSQL │      │ (Vector &  │
│   Aside)  │        │   / SQLite)  │      │  Fulltext) │
└───────────┘        └──────────────┘      └────────────┘
                            │
                            ▼
                     ┌────────────┐
                     │   QUEUES   │
                     │  (Events)  │
                     └─────┬──────┘
                           │
                           ▼
                     ┌────────────┐
                     │  WORKERS   │
                     │ (Analysis) │
                     └────────────┘

                   OBSERVABILITY
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
       LOGS              METRICS           ALERTS

                   BACKUP / RECOVERY
                           │
                           ▼
                     ┌────────────┐
                     │  BACKUPS   │
                     │ (SHA-256)  │
                     └────────────┘
```

---

## 3. Subsystem Breakdown

### 3.1 Edge & Application Security Layer
- **Root Middleware (`src/middleware.ts`)**: Enforces Content-Security-Policy (CSP), Strict-Transport-Security (HSTS), X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN, Referrer-Policy, and CORS origin verification.
- **Request Tracing**: Injects unique `X-Request-Id` for every incoming HTTP request.
- **Rate Limiting Engine (`src/lib/security/rateLimiter.ts`)**: Categorized sliding window limits (AUTH, RATINGS, REVIEWS, COMMENTS, COMMUNITY, CHAT, SEARCH, PUBLIC_READ, ADMIN).
- **Sanitization & SSRF Engine (`src/lib/security/xssSanitizer.ts`, `src/lib/security/ssrfProtection.ts`)**: Strips malicious executable HTML and blocks requests to private IPv4/IPv6, link-local, and AWS metadata subnets.
- **CSRF defense on the `anilog_token` cookie** (added 2026-09-16, `src/lib/auth.ts`): the session cookie is `httpOnly`, `secure` in production, and `sameSite: 'lax'` (set in `POST /api/auth/login` and `POST /api/auth/register`). Lax alone isn't a complete answer — it depends on browser support, doesn't cover same-site-but-different-subdomain attackers, and a same-origin CORS allowlist (§ above) doesn't stop a simple, non-preflighted cross-origin form submission crafted to look like JSON via `enctype="text/plain"`. `getAuthUserFromRequest()` (the single choke point both `requireRole()`/`requireVerifiedUser()` and every route that authenticates a user go through — audited: 154 call sites) now additionally verifies, for `POST`/`PUT`/`PATCH`/`DELETE` requests authenticated via the cookie specifically, that the request's `Origin` header (falling back to `Referer`) resolves to the app's own host (`request.nextUrl.host`, or `NEXT_PUBLIC_APP_URL`/`NEXTAUTH_URL` when set) — an untrusted or missing origin on a cookie-authenticated mutation is treated as unauthenticated, same as a missing/invalid token. Requests authenticated via `Authorization: Bearer` instead of the cookie skip this check entirely, since a browser can't attach a custom header to a cross-site request without the target's CORS cooperation in the first place — only the cookie path is CSRF-exposed.
  - **Why Origin verification over a double-submit CSRF token**: the frontend has no shared fetch wrapper — every one of the ~40 mutating `fetch()` call sites is a bare call scattered across `src/app/**`/`src/components/**`. Threading a CSRF token header through all of them (reading a non-httpOnly cookie, attaching it to every call, keeping it in sync with the session) is a much larger, higher-risk change than the protection is worth here, and Origin/Referer verification is OWASP's documented lightweight alternative for exactly this situation. It needs no frontend change: browsers always send `Origin` (or at least `Referer`) on a cross-origin-capable `POST`/`PUT`/`PATCH`/`DELETE`, including same-origin ones, so legitimate requests already carry a matching header.
  - If a future change introduces a shared frontend API client, prefer migrating to a double-submit token at that point — it doesn't depend on `Origin`/`Referer` being present or accurate, which is a strictly stronger guarantee.

### 3.2 Data & Persistence Layer
- **Prisma ORM (`prisma/schema.prisma`)**: Unified relational model with ACID transactions for rating aggregations, studio deduplication, and community state.
- **Deduplication Engine**: Canonical studio mapping and alias redirects.
- **Backup & Disaster Recovery (`src/lib/production/backupManager.ts`)**: Automated snapshot generation with SHA-256 cryptographic verification. Targets: RPO = 1 Hour, RTO = 15 Minutes.
- **Search (`src/lib/fuzzySearch.ts`, added 2026-09-16)**: Postgres full-text search (`tsvector`/`tsquery`) plus `pg_trgm` for typo-tolerant fuzzy matching across `AnimeTitle` (all title types), `Anime.canonicalTitle`, `Person.name`, and `Character.name` — replaced plain `contains`/ILIKE, which had zero typo tolerance and, in `animeCatalogEngine.ts` specifically, was case-sensitive (a live bug on Postgres). See `docs/production/SEARCH.md` for the design, migration, and a before/after latency+recall benchmark at a representative (30k-anime) catalog size.

### 3.3 Intelligence, Discovery & Personalization Layer
- **Semantic Intelligence (`src/lib/engine/ai/embeddingEngine.ts`)**: Deterministic 64D $L_2$-normalized semantic vectors with cosine similarity retrieval.
- **Review Aspect NLP (`src/lib/engine/ai/reviewIntelligenceService.ts`)**: 16-aspect sentiment extraction without altering authoritative user ratings.
- **Hybrid Recommendation Model (`src/lib/engine/ai/hybridRecommendationModel.ts`)**: 8-factor composite formula balancing relevance, Bayesian quality, creator affinity, and diversity reranking.

### 3.4 Reliability & Scaling Layer
- **Cache-Aside Engine (`src/lib/performance/cacheManager.ts`)**: two-tier — in-memory L1 (LRU-bounded) + Redis L2 (best-effort, degrades to L1-only if Redis is unreachable), TTL + multi-tag invalidation across both tiers, single-flight coalescing of concurrent misses, stale-while-revalidate for public catalog reads (`getOrSetCatalog`/`getOrSetSWR`; per-category TTLs — anime detail 1h, schedule 5min, news 15min), and *enforced* (not just conventional) user-namespace isolation: personalized keys can only be built via `userKey()`/`getOrSetForUser()`, and the public-catalog SWR methods throw if ever given one — see `tests/cache-namespace.test.ts` (a runtime check plus a source-scan across `src/` for call sites that look personalized).
- **Circuit Breaker (`src/lib/performance/circuitBreaker.ts`)**: Triple-state (CLOSED, OPEN, HALF_OPEN) failure tripping with graceful fallbacks.
- **Rollback Engine (`src/lib/production/rollbackManager.ts`)**: Instant atomic rollback of releases with automatic cache invalidation and security audit logging.
- **Health Probes (`src/lib/reliability/healthService.ts`)**: `/api/health` (Liveness) and `/api/health/ready` (Readiness).
