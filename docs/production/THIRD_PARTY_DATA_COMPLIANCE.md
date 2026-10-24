# OTAKUVA — Third-Party Data Provider Compliance (Jikan / MyAnimeList, AniList)

Added 2026-09-16. OTAKUVA's entire catalog (`Anime`, `Character`, `Person`,
`Studio`, episode/schedule data, etc.) is sourced from two third-party
APIs — Jikan (an unofficial MyAnimeList proxy) and AniList's GraphQL API —
via `src/lib/jikanService.ts` / `src/lib/providers/jikanProvider.ts` and
`src/lib/providers/anilistProvider.ts`. This doc records what their terms
of use actually say (verified against their published docs as of
2026-09-16 — re-verify before relying on any of this, terms and rate
limits both change), how the codebase's actual request pacing compares,
and one structural risk that isn't a code problem at all. Attribution
itself is live at `/credits` and in the site footer
(`src/components/shell/Footer.tsx`) — this doc is the engineering/legal
detail behind that, not the user-facing page.

## 1. Rate limits: terms vs. actual behavior

| | Documented limit | This codebase's pacing | Assessment |
| :--- | :--- | :--- | :--- |
| **Jikan v4** | 3 req/s, 60 req/min, no daily cap; Jikan caches MAL responses server-side for 24h | `jikanService.ts`'s `MIN_REQUEST_INTERVAL_MS = 800` (≤1.25 req/s) via a chained-promise queue (not a racy single-timestamp check — see its own header comment on why), honors `Retry-After` on 429, plus a 24h local response cache matching Jikan's own cache window | **Comfortable margin.** Well under both caps, with real backoff and real caching. No change needed. |
| **AniList** | 90 req/min normal; AniList's own docs stated a **temporary reduction to 30 req/min** during a "degraded" period as of this doc's research (2026-09-16) — re-check `https://docs.anilist.co/guide/rate-limiting` before trusting either number | `anilistProvider.ts`'s `RateLimiter.minIntervalMs = 700` (~85 req/min) — a **static constant sized against the normal 90/min limit**, with no awareness of the stated 30/min degraded cap. It's also a plain read-then-write timestamp check (not chained/serialized the way `jikanService.ts`'s queue is), so concurrent callers can race past it the same way `jikanService.ts`'s own header comment says its old implementation did. It never reads the `X-RateLimit-Limit`/`X-RateLimit-Remaining` response headers AniList sends — only reacts to `Retry-After` *after* actually getting a 429. And unlike Jikan, **there is no local response cache at all** for AniList — every call is always live. | **The real gap.** At ~85 req/min against a possible 30 req/min live cap, this client should expect sustained 429s if AniList's degraded state is still in effect — and AniList is the **default** provider (`src/lib/providers/index.ts`'s `PREFERRED` falls back to `'anilist'` when `ANILOG_PROVIDER`/`PREFERRED_PROVIDER` is unset — confirm which is actually configured in each environment before assuming which one serves live traffic, per `CLAUDE.md`'s own repeated caveat on this). See §3 for suggested next steps. |

Both files' retry logic already treats 429/5xx as retryable with backoff
(`RETRYABLE_STATUSES` in `jikanService.ts`; inline 429/5xx handling in
`anilistProvider.ts`), so an over-limit burst degrades into slower/retried
requests rather than silently dropped data either way — this is about
tightening margins and adding headroom-awareness, not a correctness bug.

Bulk/backfill scripts (`scripts/full_catalog_sync.ts`,
`backfill_staff_characters.ts`, `refresh_airing_episodes.ts`,
`fetch_latest_episodes.ts`, `src/lib/catalog/episodeBackfillEngine.ts`)
all crawl **sequentially**, not with unbounded `Promise.all` fan-out — the
one exception is `backfill_staff_characters.ts` firing staff+characters
for the same anime as `Promise.all([...])` (2-way, per-anime, not across
anime), which is still safe because it goes through the same shared
per-process throttle either way. The BullMQ worker
(`scripts/worker.ts`) defaults to `concurrency: 1` and has no BullMQ-native
`limiter` configured — rate protection today is entirely the two
in-process throttles above, with no second independent layer.

## 2. Not a rate-limit issue — a structural ToS question

AniList's terms of use (`https://docs.anilist.co/guide/terms-of-use`)
include two clauses that aren't about request pacing at all and that a
code fix can't resolve:

> "Using the AniList API as a backup or data storage service is strictly
> prohibited." / "Hoarding or mass collection of data from the AniList
> API is strictly prohibited."

> "Prohibited from use within competing noncomplementary services of the
> same nature. This includes, but is not limited to Anime/Manga
> list/tracker services." — with an exception for apps that "provide
> significant sustained integration/syncing with the AniList API and
> AniList user accounts."

OTAKUVA's whole architecture (`External providers → ... → Prisma
canonical DB`, per `CLAUDE.md`) is a permanent ingested copy of provider
data, and the product itself is explicitly described as an "anime
knowledge, discovery, **tracking**" platform — i.e. exactly the category
AniList's second clause names. OTAKUVA does not currently offer AniList
account linking/list-sync, which is the stated carve-out. Whether that
puts the current default-provider setup in conflict with AniList's terms
is a business/legal question, not something this doc or any code change
resolves — flagging it here because it's the single highest-severity
finding from this review, well above the rate-limit tuning in §1.
**[LEGAL REVIEW NEEDED]** before relying on AniList as the default/primary
catalog source at any real scale. Options worth a deliberate decision
(not implemented here): pursue an AniList account-sync integration to
qualify for the stated exception, negotiate directly with AniList, make
Jikan the default provider instead of AniList (Jikan's terms don't
contain an equivalent competing-service clause, though MyAnimeList's own
ToS has its own restrictions — see §4), or accept and document the risk
knowingly. `src/lib/providers/index.ts`'s `PREFERRED` default is the one
line that controls this.

## 3. Suggested next steps for the AniList pacing gap (§1) — not yet done

None of this is implemented — recorded here as the fix this doc's
research points to, for whoever picks it up:

- Tighten `anilistProvider.ts`'s `RateLimiter.minIntervalMs` to reflect
  whichever cap (30 or 90 req/min) is actually in effect *right now*
  (check `X-RateLimit-Limit` on a live response rather than assuming).
- Make the throttle read `X-RateLimit-Remaining` and slow down
  proactively as it approaches zero, instead of only reacting after a 429.
- Fix the same race-condition class `jikanService.ts`'s header comment
  already documents fixing there: `RateLimiter.throttle()`'s
  read-then-write on `lastRequest` isn't atomic across concurrent callers.
- Consider adding a response cache for AniList similar to `jikanService.ts`'s
  24h `memoryCache`, at least for slowly-changing data (completed series
  metadata) — every AniList call is currently live with zero local cache.

## 4. MyAnimeList's own terms (Jikan proxies MAL, doesn't replace its ToS)

Jikan's own docs explicitly defer to MAL's terms ("Please be respectful
towards MyAnimeList's Terms Of Service"). MAL's ToU
(`https://myanimelist.net/about/terms_of_use`) prohibits automated
systems that "send more request messages... than a human can reasonably
produce" (Jikan's pacing in §1 already keeps this app well under that),
restricts "collating or aggregating available content for use elsewhere"
without authorization, and limits commercial use to personal,
non-commercial purposes. Jikan is a third-party open-source project, not
an official MAL integration, so how directly these clauses bind an app
using Jikan (rather than MAL's API directly) is itself unclear —
**[LEGAL REVIEW NEEDED]**, lower urgency than §2 since MAL's clause is
vaguer and less specifically targeted at this use pattern than AniList's,
but the same underlying tension (a tracking product built on a permanent
copy of the provider's catalog) applies here too.
