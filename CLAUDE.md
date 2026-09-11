# OTAKUVA

Anime knowledge, discovery, tracking, and community platform. Package name is
still `anilog` (legacy) — the product and UI brand is **OTAKUVA**. Do not
rename the package without asking; it touches lockfiles/CI.

## What this is not

Not a streaming site, not a MyAnimeList/AniList clone, not an API-response
frontend, not a static catalog, not a generic social network. It's a
connected knowledge graph: Anime ↔ Characters ↔ Voice Actors ↔ Staff ↔
Studios ↔ Franchises ↔ News ↔ History ↔ Community ↔ personal tracking.

## Architecture (already in place — extend it, don't bypass it)

```
External providers → Provider Adapters → Ingestion/Sync → Normalization →
Entity Resolution → Prisma (canonical DB) → Next.js API routes → Frontend
```

The frontend (`src/app`, `src/components`) must **never** call a third-party
API directly — always through `src/app/api/**` reading from Prisma.
Provider-specific logic stays inside `src/lib/providers/**` /
`src/lib/news/**`, never in components (no `if provider === 'jikan'` in UI).

- **Provider interfaces**: `src/lib/providers/animeProvider.interface.ts`
  (`AnimeProvider`), `src/lib/news/newsProvider.interface.ts`. New providers
  implement the interface and register in `src/lib/providers/index.ts`
  (selected via `ANILOG_PROVIDER` / `PREFERRED_PROVIDER` env var).
- **Current adapters**: `anilistProvider` (default), `jikanProvider`,
  `danbooruProvider` (media), `annNewsProvider` (news).
- **Canonical DB**: `prisma/schema.prisma` (~65 models). Key groups:
  - Core entities: `Anime`, `AnimeTitle`, `AnimeExternalId`, `Studio`,
    `Person`, `Character`, `Franchise`, `Episode`, `Genre`, `Theme`,
    `Producer`, `Licensor`, plus join tables (`AnimeStudio`,
    `AnimeCharacter`, `AnimeStaff`, `AnimeRelation`, `FranchiseAnime`, …).
  - Provenance / sync: `SyncJob`, `SyncCheckpoint`, `DataSourceRecord`,
    `ProviderPayload`, `DeadLetterQueue`.
  - Conflict/editorial layer: `DataConflict`, `EditorialOverride`,
    `DataCorrectionRequest`, `AnimeMetadataHistory`, `PotentialDuplicate`.
  - News: `NewsArticle` + `NewsArticleAnime/Studio/Person` link tables.
  - Users/community: `User`, `UserAnime`, `UserEpisodeProgress`,
    `AnimeRating`, `Review`, `Favorite`, `Community*`, `Discussion*`,
    `Report`, `ModerationAction`, `UserList*`, `Activity`, `Follow`,
    `Notification`.
- **Admin/Data Studio (early)**: `src/app/admin/data/`,
  `src/app/api/admin/{data,sync,datacenter}`. Treat this as the seed of the
  full Data Studio (§45–52 of the original spec) — extend, don't replace.

## Non-negotiable rules

1. **Three data layers** — never blur them: (1) raw provider data, (2)
   normalized canonical DB rows, (3) human-verified editorial data
   (`EditorialOverride`). Editorial/manual values win and must not be
   silently overwritten by sync.
2. **No hallucinated data.** Missing info stays missing (`null` /
   unverified) or goes to a review/conflict queue — never invented anime,
   dates, staff, quotes, sources, or stats.
3. **User data is sacred.** Sync/import jobs must never touch `UserAnime`,
   ratings, reviews, favorites, lists, follows, community posts, profiles,
   settings.
4. **No hardcoded production catalogs.** No `const anime = [...]` for real
   content in components — DB is the source of truth. Fixtures under
   `src/fixtures/` are dev/seed only, never treated as production data.
5. **Provenance on everything imported**: source provider, external id,
   fetched/verified timestamps. Don't drop this to save a join.
6. **Failure isolation**: a provider outage or malformed response must never
   cascade into deleting/blanking existing DB rows. Sync failures go to
   `DeadLetterQueue` / retry, not silent deletion.
7. **Secrets** stay server-side only (env vars), never in client bundles or
   committed files. See `.env.example` for the current variable set.
8. **Conflicts are explicit**: disagreeing provider values create a
   `DataConflict` row for admin resolution, not a silent overwrite.

## When requirements conflict, priority order

Security → data integrity → reliability → correctness → maintainability →
performance → accessibility → UX polish → visual effects. Never trade
security or data integrity for polish.

## Additional production rules (from the extended charter)

- **Deletion safety**: a provider returning 404/empty/null/a temporary error
  must never be interpreted as "delete this entity." Deletion requires
  explicit, verified logic — treat provider silence as a sync failure
  (`DeadLetterQueue`/retry), not evidence of removal.
- **Source trust isn't uniform.** Not all providers/sources are equally
  authoritative; treat authority as configurable per-field where it matters
  (e.g. a studio's founding year: official source > structured provider >
  secondary source > community claim), not a single global provider
  priority.
- **Review queue over silent action.** Uncertain entity matches, conflicting
  values, suspicious data, and manual submissions go to a review queue
  rather than being auto-accepted or auto-merged. "Verified" means an admin
  or a sufficiently trusted source confirmed it — not merely that an API
  returned it.
- **Migrations**: prefer expand → migrate → contract over destructive
  in-place changes; avoid irreversible migrations unless there's no
  alternative; back up before destructive schema changes.
- **RBAC roles (target, not yet implemented)**: User, Moderator, News
  Editor, Data Editor, Media Manager, Administrator, Super Administrator.
  `User.role` doesn't exist yet in the schema — see gap list below.
- **Never** log secrets, expose full secrets in admin UI, or trust client
  input without server-side validation, even on admin routes.

## Build phases (target order) vs. current state

The charter's intended build order is: Foundation → Knowledge core →
Provider system → History → News → User platform → Community → Data Studio
→ Discovery → Production hardening. This repo has already gone wide across
most phases at a scaffold level rather than strictly sequential depth. Known
gaps against later phases, from the last audit (2026-08-28):

- **No background job queue** — `api/admin/sync` runs sync inline in the
  HTTP request; `SyncJob`/`DeadLetterQueue` tables exist but nothing drives
  them on a schedule (no cron/worker found).
- ~~No platform-level RBAC~~ — fixed: `User.role` + `src/lib/roles.ts`
  (`requireRole` / `hasMinRole`). Use those; don't compare role strings.
- ~~No automated tests~~ — `npm test` (node:test via tsx, `tests/**`) runs
  route handlers against a throwaway SQLite DB. Never write tests that
  touch `prisma/dev.db`; the old `src/lib/test_*.ts` scripts did and
  polluted the catalog with fixtures.
- **SQLite dev DB** — Postgres is still "Phase 2" per `.env.example`.
- **AniList public API disabled upstream** (403 "temporarily disabled",
  seen 2026-09-11) although it is the default provider — Jikan works.
- **Pending owner sign-off (2026-09-11 audit, not yet done):** delete the
  seeded persona `user_default` ("Atul Swain", no password, 2 reviews, 4
  ratings that count toward OTAKUVA scores), ~17 test accounts, 3 test
  communities, fixture anime `mind-paradox-*`/`daily-laughs-*` and studio
  `MAPPA AI Intelligence *`; 161 placeholder "Episode N" rows (29 with
  user progress); 4,615 unretried Jikan rows in `DeadLetterQueue`.
- Episode import for long runners is truncated (e.g. Naruto 100/220),
  which is why the broadcast-slot schedule can't infer episode numbers.
- Responsive QA: `scripts/qa_responsive_overflow.mjs` (headless Chrome
  via CDP). Don't judge mobile layout from `chrome --screenshot
  --window-size` — headless windows have a ~500px minimum width.
- Not yet verified: object storage vs. local files for `MediaAsset`, search
  index vs. plain DB queries, backup/restore procedure.

See `docs/AUDIT_2026-09-11.md` for the full audit and root causes.

Treat this list as the actual Phase 10 (production hardening) backlog for
this repo — update it here as items get fixed instead of re-deriving it.

## Working style for this repo

- Inspect existing routes/schema/components before adding new ones — most
  requested features already have a partial implementation somewhere in
  `src/app/api/**`, `src/lib/**`, or `prisma/schema.prisma`.
- Extend the Prisma schema with migrations; don't hand-edit the SQLite/PG
  file. Dev DB is SQLite (`prisma/dev.db`); spec target is PostgreSQL
  ("Phase 2" per `.env.example`) — confirm before assuming Postgres-only
  features are available.
- Keep API responses versioned/stable (`/api/...` today; don't break
  existing route contracts casually).
- Match existing conventions: CSS Modules per component
  (`Component.module.css`), route handlers under `src/app/api/**/route.ts`,
  provider types prefixed `Provider*` in the interface files.
- Full original product vision (100-section spec covering UI direction,
  Data Studio workflows, history/timeline model, security, scaling, future
  expansion into manga/games/music, etc.) was provided by the user in chat
  and is not duplicated here in full — ask for it again if a section's
  detail is needed and it isn't covered above.
