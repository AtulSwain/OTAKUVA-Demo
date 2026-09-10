# OTAKUVA — PHASE 5 REPOSITORY AUDIT REPORT
**IMAGE INFRASTRUCTURE + REAL-WORLD SCHEDULE + PRODUCTION CACHING**

*Audit Timestamp: 2026-09-05*  
*Author: Senior Full-Stack Architect, Backend, Data, Infrastructure, Performance & QA Engineer*

---

## 1. Executive Summary

OTAKUVA is transitioning into **Phase 5: Image Infrastructure + Real-World Schedule + Production Caching**.
This audit examines all existing subsystems across data models, image handling, scheduling, caching, provider adapters, background jobs, and API routes to establish a strict, non-destructive, production-grade architectural baseline.

---

## 2. Comprehensive Inventory: What Exists vs. What is Missing

### 2.1. Image Infrastructure
| Component | Existing State | Audit Finding / Gap | Target Architecture in Phase 5 |
| :--- | :--- | :--- | :--- |
| **`MediaAsset` Model** | Present in `prisma/schema.prisma` (lines 1809–1826) with basic fields (`animeId`, `type`, `source`, `sourceUrl`, `storedUrl`, `width`, `height`, `format`, `lastVerifiedAt`). | Missing multi-entity polymorphism (`entityType`, `entityId`), `checksum` (SHA-256), `status` (`PENDING`, `VALID`, `INVALID`, `BROKEN`, `RETRYING`, `ARCHIVED`), `isPrimary`, `isVerified`, `isActive`, `retryCount`, `failureReason`, and `lastValidatedAt`. | Extend `MediaAsset` model non-destructively; index by `[entityType, entityId]`, `[checksum]`, `[status]`, `[type, isPrimary]`. |
| **Image Validation** | `src/lib/engine/media/imageHealthService.ts` contains basic string pattern check (`isCleanImageUrl`). | Missing binary magic byte header validation, content-type checks, dimension verification, HTTP status validation (404, 403, 500, redirect loops), SSRF security protections (private IP blocking), and corrupted file detection. | Build canonical `ImageValidator` with SSRF protection, binary magic byte validation (JPEG, PNG, WEBP, AVIF), dimension/size bounds, and content hashing. |
| **Image Component** | Standard `next/image` in UI, occasional direct string fallbacks (e.g. `placehold.co`). | Missing unified `MediaImage` component with deterministic multi-level fallback hierarchy, local SVG entity placeholders, responsive variant sizes, and error recovery. | Create `src/components/ui/MediaImage.tsx` with zero third-party placeholder dependencies and fallback hierarchy (Primary Verified → Secondary Verified → Local OTAKUVA SVG Placeholder). |
| **Image Health Worker** | Static scan method in `ImageHealthService`. | Missing asynchronous background worker with exponential backoff retries, stale asset validation, provider re-verification, and failure logging. | Create `ImageHealthCheckWorker` with idempotent job execution, exponential backoff, and admin override protection. |
| **Image Admin CMS & Metrics** | Missing centralized admin management for media assets. | Data editors/admins cannot inspect broken images, verify replacements, or audit data health. | Implement `/api/admin/media` endpoint and Media Asset CMS with data health metrics. |

### 2.2. Real-World Anime Schedule Infrastructure
| Component | Existing State | Audit Finding / Gap | Target Architecture in Phase 5 |
| :--- | :--- | :--- | :--- |
| **Schedule Schema (`AiringSchedule`)** | Enhanced in Phase 4 with `seasonId`, `originalAiringAt`, `originalTimezone`, `delayReason`, `notes`, `region`, `isVerified`, `sourceProvider`. | Missing explicit `isOverride` flag and `ScheduleHistory` tracking table to record release time changes (`previousReleaseAt`, `newReleaseAt`, `reason`, `source`). | Add `isOverride Boolean @default(false)` and `model ScheduleHistory` to track schedule mutations. |
| **Schedule Engine** | `ScheduleEngine` and `scheduleTimezone.ts` implemented with zero N+1 queries, IANA timezones, and Up Next support. | Provider sync in `syncEngine.ts` needs rate limiting, request deduplication (single-flight coalescing), and multi-provider conflict resolution (Admin > AniList > Jikan). | Integrate `ScheduleSyncWorker`, request deduplicator, and source priority conflict resolver. |
| **UI & Routes** | `/schedule` and `/api/schedule`, `/api/schedule/up-next`, `/api/schedule/reminders`, `/api/schedule/admin`. | Working cleanly; needs integration with unified multi-tier caching and `MediaImage`. | Preserve existing routes and enhance with cache headers and `MediaImage`. |

### 2.3. Production Caching Infrastructure
| Component | Existing State | Audit Finding / Gap | Target Architecture in Phase 5 |
| :--- | :--- | :--- | :--- |
| **Cache Service** | Basic in-memory `CacheManager` with tag invalidation. | Missing unified multi-tier `CacheService` (Memory + Redis with fallback), request coalescing / single-flight stampede protection, SWR (stale-while-revalidate), category-specific TTL policies, and versioned keys (`v1:anime:...`, `v1:schedule:...`). | Implement production-grade `CacheService` with multi-tier adapters, stampede lock/coalescing, and public vs. user-private isolation. |
| **Private Cache Isolation** | `userKey` helper exists in `CacheManager`. | Need strict architectural guardrail: user-specific data (library, watch progress, personalized Up Next) must NEVER be written to shared public cache keys. | Enforce distinct namespaces (`v1:public:...` vs `v1:user:{id}:...`) with validation. |
| **Cache Invalidation** | Tag-based invalidation in `CacheManager`. | Need domain-driven invalidation hooks on Anime updates, Schedule updates, Episode updates, and Image modifications. | Implement `CacheInvalidator` with targeted domain event bindings. |

---

## 3. Systems to Reuse, Refactor, or Preserve

### 3.1. What to Reuse (Do Not Rewrite)
1. **Canonical Anime / Season / Episode Architecture**:
   - `src/lib/engine/anime/animeCatalogEngine.ts`
   - `src/lib/engine/anime/seasonEngine.ts`
   - `src/lib/engine/anime/episodeEngine.ts`
   - `src/lib/animeTitleResolver.ts`
2. **API Handler & Contracts**:
   - `src/lib/api/apiHandler.ts` (`withApiHandler`, execution timing, security headers)
   - `src/lib/contracts/apiContracts.ts` (`ApiResponse`, `PaginationMeta`, DTOs)
   - `src/lib/security/apiValidator.ts` (sanitization and parameter validation)
3. **Phase 4 Schedule Timezone Foundation**:
   - `src/lib/engine/schedule/scheduleTimezone.ts` (IANA timezone parsing, DST bounds calculation, countdown math)
   - `src/lib/engine/schedule/scheduleEngine.ts` (query building, Up Next logic, reminders)
4. **Existing Next.js App Router Structure**:
   - `/api/schedule`, `/api/schedule/up-next`, `/api/schedule/reminders`, `/api/schedule/admin`
   - `/schedule/page.tsx`

### 3.2. What to Refactor & Enhance
1. **`prisma/schema.prisma`**:
   - Extend `MediaAsset` with polymorphic entity fields, SHA-256 checksum, status, and health metrics.
   - Add `isOverride` to `AiringSchedule` and introduce `ScheduleHistory` model.
2. **`CacheManager` → `CacheService`**:
   - Upgrade into a robust, multi-tier caching service with single-flight coalescing, TTL policies, Redis adapter with memory fallback, and SWR.
3. **`ImageHealthService` → Canonical Image Infrastructure**:
   - Add `ImageValidator` with SSRF protection, binary magic byte checks, and checksum calculation.
   - Add `MediaAssetService` for deduplicated asset ingestion, provenance retention, and resolution.
   - Add `ImageHealthCheckWorker` for background validation, retries, and quarantine.
   - Add `MediaImage` React component with local SVG entity placeholders.
4. **Provider Synchronization & Deduplication**:
   - Implement `RequestDeduplicator` (Single-Flight) for provider and schedule calls.
   - Enhance `syncEngine.syncWeeklySchedule` with conflict resolution and history recording.

### 3.3. What NOT to Touch
- Do not touch unrelated features (e.g. Chat, Community Discussions, Studio Merge/Knowledge Graph, Recommendation Matrix Factorization / AI models) except where caching or image components are integrated.
- Do not reset the SQLite database (`dev.db`).
- Do not create duplicate routes or duplicate schedule systems.

---

## 4. Architectural & Safety Risks

1. **Database Safety**: All Prisma schema modifications must be additive (optional/defaulted fields). Run `prisma db push` safely without data drops or table truncations.
2. **SSRF (Server-Side Request Forgery)**: External image validation must reject loopback (`127.0.0.1`, `localhost`), link-local (`169.254.x.x`), private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and non-HTTP(S) protocols.
3. **Cache Stampede / Dogpiling**: High-traffic endpoints (e.g. `today` schedule across multiple timezones) must use in-memory single-flight promise sharing so that 100 concurrent requests trigger only 1 database query.
4. **Private vs. Public Cache Leakage**: Personalized library queries (`libraryOnly=true`) must never be written to public cache keys.
5. **Provider Resilience**: Provider 429 rate limits, 500 errors, or empty responses must never overwrite or delete canonical schedule or media asset records.

---

## 5. Phase 5 Implementation Blueprint

```
                     EXTERNAL PROVIDERS
                   (AniList, Jikan, etc.)
                             │
                             ▼
                   PROVIDER RATE LIMITER
                             │
                             ▼
                   REQUEST DEDUPLICATOR
                      (Single-Flight)
                             │
                             ▼
                    PROVIDER RAW CACHE
                             │
                             ▼
               CANONICAL IDENTITY RESOLVER
             (Anime ↔ Season ↔ Episode)
              /                      \
             ▼                        ▼
     IMAGE INFRASTRUCTURE     SCHEDULE INFRASTRUCTURE
     - ImageValidator          - scheduleTimezone
     - MediaAssetService       - ScheduleEngine
     - Checksum Deduplication  - Conflict Resolver
     - ImageHealthWorker       - ScheduleHistory Tracker
             \                        /
              ▼                      ▼
                CANONICAL DATABASE (Prisma)
              (MediaAsset, AiringSchedule, etc.)
                             │
                             ▼
                   UNIFIED CACHE SERVICE
         (Multi-Tier, TTL Policy, SWR, Invalidation)
                             │
                             ▼
                     OTAKUVA API LAYER
          (/api/schedule, /api/media, /api/anime, etc.)
                             │
                             ▼
                     FRONTEND (OTAKUVA)
              (MediaImage, Schedule UI, Up Next)
```

---

*Audit Complete. Proceeding to implementation plan creation and execution.*
