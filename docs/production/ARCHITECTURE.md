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

### 3.2 Data & Persistence Layer
- **Prisma ORM (`prisma/schema.prisma`)**: Unified relational model with ACID transactions for rating aggregations, studio deduplication, and community state.
- **Deduplication Engine**: Canonical studio mapping and alias redirects.
- **Backup & Disaster Recovery (`src/lib/production/backupManager.ts`)**: Automated snapshot generation with SHA-256 cryptographic verification. Targets: RPO = 1 Hour, RTO = 15 Minutes.

### 3.3 Intelligence, Discovery & Personalization Layer
- **Semantic Intelligence (`src/lib/engine/ai/embeddingEngine.ts`)**: Deterministic 64D $L_2$-normalized semantic vectors with cosine similarity retrieval.
- **Review Aspect NLP (`src/lib/engine/ai/reviewIntelligenceService.ts`)**: 16-aspect sentiment extraction without altering authoritative user ratings.
- **Hybrid Recommendation Model (`src/lib/engine/ai/hybridRecommendationModel.ts`)**: 8-factor composite formula balancing relevance, Bayesian quality, creator affinity, and diversity reranking.

### 3.4 Reliability & Scaling Layer
- **Cache-Aside Engine (`src/lib/performance/cacheManager.ts`)**: In-memory LRU with TTL, multi-tag invalidation, and strict user namespace isolation.
- **Circuit Breaker (`src/lib/performance/circuitBreaker.ts`)**: Triple-state (CLOSED, OPEN, HALF_OPEN) failure tripping with graceful fallbacks.
- **Rollback Engine (`src/lib/production/rollbackManager.ts`)**: Instant atomic rollback of releases with automatic cache invalidation and security audit logging.
- **Health Probes (`src/lib/reliability/healthService.ts`)**: `/api/health` (Liveness) and `/api/health/ready` (Readiness).
