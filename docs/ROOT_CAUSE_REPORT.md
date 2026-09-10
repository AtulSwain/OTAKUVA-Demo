# OTAKUVA Root Cause Report

## Audit scope

- Next.js 14 App Router with TypeScript and Prisma 5.
- SQLite is the configured development database; the schema contains canonical `Anime`, `Episode`, `UserAnime`, and `UserEpisodeProgress` models.
- Authentication is JWT-based and resolves the user from the database on each request.
- There are two episode mutation paths: the canonical `/api/anime/[id]/episodes/[episodeId]/progress` route and the legacy `/api/episodes/[animeId]` route.

## Findings

### 1. Episode watch state

The active `LibraryContext` toggles episodes by number and calls `/api/episodes/[animeId]`. That route creates an `Episode` row when the requested number is missing, then recalculates aggregate progress from all progress rows. This allows UI state and fabricated episode rows to become persistent data, instead of requiring a canonical episode loaded from the database.

The canonical route already validates `episodeId` against `animeId`, uses `userId` from authenticated JWT state, and delegates the one-episode mutation to `toggleEpisodeWatchStatus`. The repair is to make that route the client mutation path and reject missing canonical episode IDs in the legacy path.

### 2. Database safeguards

The schema already has `unique(animeId, number)` on `Episode`, `unique(userId, episodeId)` on `UserEpisodeProgress`, and a composite user/anime uniqueness constraint on `UserAnime`. `UserEpisodeProgress` also stores `animeId`, but the current mutation path must continue verifying the episode's owning anime before writing.

### 3. Provider and loading reliability

Jikan requests are centralized in `jikanService` with pacing, retry, in-flight request coalescing, and an in-memory cache. However, episode/character/staff data can fall back to direct Jikan reads in `animeData`, and `jikanService` contains hardcoded fixture fallback records. This means provider failure can produce non-canonical or invented-looking content instead of a clearly degraded response. This requires a separate provider/data-integrity pass.

### 4. Pagination

The episode service passes a page to Jikan and exposes pagination, but database-backed episodes are paginated locally and the import path was not established by this audit as a complete resumable ingestion workflow. Pagination and import resumption remain open work.

### 5. Images

`next.config.mjs` allows every HTTP and HTTPS hostname and uses unoptimized images. The schema stores poster/banner URLs and has `MediaAsset`, but this audit did not find evidence that all provider URLs are validated and promoted through managed storage. Image validation and repair remain open work.

### 6. Immediate validation check

The focused regression check is: a client toggle must POST the canonical episode ID, and a mismatched anime/episode pair must be rejected before any progress row is written. Type checking plus the existing watch-engine test suite are the first executable checks after the repair.

### 7. Schedule and multi-season audit

The repository already had `/schedule` and `AiringSchedule`, but the route synchronously triggered an AniList sync when the table was empty. Schedule rows had no canonical `episodeId`, no release type/timezone/status, and the client guessed library membership from an unscoped local map. No `AnimeSeason` model exists; franchise relationships are represented by `FranchiseAnime`, while episodes are directly owned by `Anime`.

The schedule repair adds canonical episode linkage and schedule metadata, permits distinct release types per anime/episode, removes provider sync from the request path, adds authenticated `library=true` filtering, and groups days using the requester timezone. Jikan schedule responses do not provide a verified episode-specific release event for every item, so the ingestion layer must not fabricate one from a broadcast date or total episode count.

## Completed in the Jikan pass

- `JikanProvider` now uses the shared `jikanFetch` transport instead of maintaining a second throttle/retry implementation.
- Shared requests now have a 15-second abort timeout, retries for 408/429/500/502/503/504, exponential backoff with jitter, `Retry-After` support, and malformed JSON rejection.
- Existing in-flight request deduplication and cache behavior are now shared by provider-adapter callers.
- No browser-side references to `api.jikan.moe` or `JIKAN_BASE_URL` were found in the scanned App Router/components paths.

## Prioritized remaining work

1. Replace hardcoded Jikan fallback records with canonical database-only degraded responses or verified provider cache entries.
2. Repair provider fallbacks and resumable pagination without inventing data.
3. Complete managed image validation/storage and aggregate anime API loading.
4. Add explicit transport tests for 429, timeout, malformed JSON, and retry exhaustion.

The schedule migration is present at `prisma/migrations/20260904064428_add_schedule_episode_metadata/migration.sql` and `prisma migrate status` confirms it is applied. The initial migration command reported drift while creating the baseline, so future schema changes should still be checked carefully against the existing SQLite database.

The current architecture pass also adds `/api/anime/[id]/seasons`, backed by canonical `FranchiseAnime` rows. The anime detail page renders those records as navigable season/related entries. There is still no standalone `AnimeSeason` model because the existing data represents seasons and specials as separate anime/franchise entries; introducing one requires an explicit data migration and provider mapping policy.

## Real-world data update

- The bounded Jikan catalog import created five canonical anime records before fallback removal; they are real titles but should receive a provenance review because the provider was returning intermittent 504 responses during that run.
- A paginated Jikan episode import added 187 episode upserts across five provider pages, keyed by canonical `animeId` plus episode number.
- The corrected catalog importer now imports zero records when Jikan is unavailable instead of importing fallback defaults.
- The verified schedule sync currently produces zero rows because the existing catalog has no matching current provider schedule entries and no schedule records were fabricated.