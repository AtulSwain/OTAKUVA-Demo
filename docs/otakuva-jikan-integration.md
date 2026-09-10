# OTAKUVA — Jikan v4 Integration Reference

---

## 1. Overview & Capabilities

OTAKUVA integrates with Jikan API v4 (`https://api.jikan.moe/v4`) strictly as an external, rate-limited, cached, and validated data ingestion provider.

The frontend **never** calls Jikan directly. All requests pass through the server-side provider abstraction (`src/lib/providers/jikanProvider.ts`) and central HTTP client (`src/lib/jikanService.ts`).

---

## 2. Supported Domain Endpoints

| OTAKUVA Domain Method | Jikan v4 Endpoint | Purpose |
| :--- | :--- | :--- |
| `getAnime(id)` | `/anime/{id}` | Basic anime metadata |
| `getAnimeFull(id)` | `/anime/{id}/full` | Deep anime metadata with titles, producers, studios, genres |
| `getAnimeCharacters(id)` | `/anime/{id}/characters` | Character roster and voice actors |
| `getAnimeStaff(id)` | `/anime/{id}/staff` | Directors, writers, music composers |
| `getAnimeEpisodes(id, page)` | `/anime/{id}/episodes` | Episode list with titles, airing dates, filler/recap flags |
| `getAnimeRelations(id)` | `/anime/{id}/relations` | Sequels, prequels, spin-offs, side stories |
| `getAnimeVideos(id)` | `/anime/{id}/videos` | Promotional videos and official trailers |
| `getAnimePictures(id)` | `/anime/{id}/pictures` | High-resolution promotional artwork |
| `getAnimeNews(id)` | `/anime/{id}/news` | Industry articles and announcements |
| `getAnimeReviews(id)` | `/anime/{id}/reviews` | Editorial reviews and reception |
| `getAnimeRecommendations(id)`| `/anime/{id}/recommendations` | User recommendation signals |
| `getAnimeStreaming(id)` | `/anime/{id}/streaming` | Licensed streaming platforms |
| `getAnimeStatistics(id)` | `/anime/{id}/statistics` | Community score distributions |
| `getTopAnime(page, limit)` | `/top/anime` | Global rankings and popularity |
| `getSeasonalAnime(year, season)` | `/seasons/{year}/{season}` | Seasonal broadcast index |

---

## 3. Resilience, Throttling & Fault Tolerance

1. **Token Bucket Rate Limiting**:
   Enforces a strict 800ms minimum interval between outgoing requests (~2.5 requests/second) to prevent HTTP 429 and 504 timeouts.
2. **In-Flight Request Deduplication**:
   When multiple concurrent server actions request the same endpoint, `inFlightRequests` stores the active `Promise<T>` and shares the single HTTP response across all callers.
3. **Tiered In-Memory Caching**:
   - 24-hour TTL for finished/static anime metadata, relations, and staff.
   - 6-hour TTL for airing anime schedules and episodes.
   - 12-hour TTL for news and reviews.
4. **Exponential Backoff & Retries**:
   Retries transient network and 5xx errors (up to 2 retries with exponential backoff: 1500ms, 3000ms).
5. **Canonical Database Fallback**:
   If Jikan experiences downtime or network partitions, OTAKUVA continues serving existing canonical records without user interruption.
