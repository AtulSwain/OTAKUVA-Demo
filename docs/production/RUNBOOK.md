# OTAKUVA — Production Operations Runbook

## 1. Quick Reference & System Health

| Check | Endpoint / Command | Expected Output |
| :--- | :--- | :--- |
| **Liveness** | `GET /api/health` | `{"status": "UP", ...}` (HTTP 200, always — no dependency checks; see §8) |
| **Readiness / external uptime monitor** | `GET /api/health/ready` | `{"status": "HEALTHY", ...}` (HTTP 200) or `{"status": "UNHEALTHY", ...}` (HTTP 503) — checks DB connectivity; point an external uptime monitor here, not at `/api/health` (see §8) |
| **Launch Status** | `GET /api/production/status` | `{"decision": "GO", ...}` (HTTP 200) |
| **Alerts** | `GET /api/production/alerts?unresolved=true` | `{"success": true, "alerts": [...]}` |
| **Metrics** | `GET /api/admin/performance/metrics` | `{"performance": { "p95Ms": ... }}` |

---

## 2. Standard Operating Procedures (SOP)

### SOP-01: Deploying a New Release
Full checklist (staging deploy → smoke test → production deploy → smoke
test → rollback path) is `docs/production/DEPLOYMENT_AND_ROLLBACK.md` —
follow that, not the summary below. In short: CI green (typecheck, lint,
`npm test` — §9 below; **not** `src/lib/test_phase12_production_readiness_
master.ts`, which runs against whatever `DATABASE_URL` is active rather
than an isolated database and is exactly the ad-hoc-script-against-a-real-
database pattern `CLAUDE.md`'s cleanup history warns about) → real
Postgres backup (`pg_dump`, not `POST /api/production/backup` — see that
doc's opening note on why) → migrate → deploy → verify `/api/health/ready`
→ smoke test (health, login, one write path) → repeat against production.

### SOP-02: Executing an Emergency Rollback
Full procedure — redeploying the previous build artifact, plus the
migration-down decision tree — is `docs/production/
DEPLOYMENT_AND_ROLLBACK.md` §7. The steps below are the in-app
`RollbackManager` call that's *part of* that procedure (cache/circuit-
breaker cleanup and the audit trail), not a substitute for actually
redeploying the previous artifact — see that doc's opening note for why.
1. Redeploy the previous build artifact at the infra layer (§7.1 of that
   doc) — this is the step that actually reverts the running code.
2. Then call:
   ```ts
   await RollbackManager.executeRollback("Critical regression reason", "OnCall_Engineer");
   ```
   which:
   - Updates the in-app active-release pointer to match
   - Flushes in-memory cache
   - Resets circuit breakers
   - Records a security audit log event
3. Verify `/api/health/ready` and monitor error rates.

### SOP-03: Secret Rotation
1. Generate new 256-bit cryptographically secure secret:
   ```ts
   const newSecret = EnvValidator.generateSecureSecret();
   ```
2. Update secret in production environment / secret manager (`AUTH_SECRET`).
3. Trigger rolling restart of application instances.

### SOP-04: Responding to High Error Rate Alerts
1. Inspect active alerts: `GET /api/production/alerts`.
2. Check database query health in `/api/health/ready`.
3. Check latency and 5xx logs in `/api/admin/performance/metrics`.
4. If an external service is causing cascading failures, verify circuit breaker is in `OPEN` state.
5. If regression originated from new release, execute **SOP-02: Emergency Rollback**.

---

## 6. Background Job Queue (BullMQ + Redis)

Catalog sync, anime import, news sync, and schedule sync no longer run
inline inside a Next.js request or a hand-run terminal script. They're
jobs on a BullMQ queue (`otakuva-sync`, backed by Redis) that a **second,
separate process** consumes — `scripts/worker.ts`. `next start` (or
`next dev`) only ever *enqueues* this work now (`POST /api/admin/sync`,
`POST /api/admin/anime/import`, and their equivalents) and returns
immediately with a job id; nothing progresses unless the worker process is
also running. See `src/lib/queue/**` for the implementation and
`CLAUDE.md`'s Phase 10 backlog (item 6) for how this relates to the
"no background job queue" gap noted there — this closes it for these six
job kinds specifically, not as a general-purpose scheduler for arbitrary
future jobs.

### 6.1 What's queued

| Job name | Replaces | Trigger |
|---|---|---|
| `sync:anime` | `POST /api/admin/sync {"action":"SYNC_ANIME"}` inline logic | manual (route) |
| `sync:catalog` | `POST /api/admin/sync {"action":"SYNC_CATALOG"}` inline logic | manual (route) |
| `sync:airing` | `POST /api/admin/sync {"action":"SYNC_AIRING"}`, `scripts/sync_real_world_schedule.ts` | manual (route/script) **and** recurring, every 6h |
| `sync:broadcast-schedule` | `POST /api/admin/sync {"action":"SYNC_BROADCAST_SCHEDULE"}`, `scripts/sync_broadcast_schedule.ts` | manual (route/script) **and** recurring, every 30min |
| `anime-import` | `POST /api/admin/anime/import` (was `JikanImportJobManager`, in-memory) | manual (route: start/resume) |
| `news-sync` | `scripts/news_poller.ts`'s per-cycle work | manual (script, `--loop` or one-shot) **and** recurring, every 60s |
| `episode-backfill` | *(new — no manual predecessor)* `src/lib/catalog/episodeBackfillEngine.ts`, resumable catalog-wide episode paging | recurring only, every 2min, 10 pages/tick |

The four recurring ones are registered once via BullMQ's Job Scheduler
(`queue.upsertJobScheduler`, see `src/lib/queue/recurring.ts`) every time
the worker starts up — idempotent, so a worker restart doesn't create
duplicate schedules.

**`episode-backfill` specifically** works through every anime with a known
provider id (currently-airing first, then by popularity), paging its
episode list and writing each page as it's fetched rather than buffering
a whole anime's episodes in memory. It's resumable at the *page* level via
one `SyncCheckpoint` row (`provider='multi'`, `jobType='EPISODE_BACKFILL'`)
— the checkpoint only advances after a page's episodes are durably
written, so a mid-run failure (provider error, timeout, DB hiccup) leaves
it exactly on the page that failed; the next tick (whether that's a
BullMQ retry moments later or the next scheduled 2-minute tick) resumes
there; it never restarts the anime or the catalog-wide cursor. An anime
whose recorded episode count already matches its declared total is
skipped (so the job converges instead of re-fetching forever); a
currently-airing anime never "completes" this way and gets revisited
every time the cursor wraps back to the top. Check progress via
`SELECT * FROM "SyncCheckpoint" WHERE provider='multi' AND jobType=
'EPISODE_BACKFILL'` — `lastProcessedId` is the most recently *completed*
anime, `page` is where it's currently paging if `metadata.currentAnimeId`
is set.

### 6.2 Retry / dead-letter policy

Every job gets 5 attempts with exponential backoff (5s, 10s, 20s, 40s,
80s — `src/lib/queue/queue.ts`). A job's `SyncJob` row (same table the
admin UI has always read — `GET /api/admin/datacenter`,
`GET /api/admin/anime/import`, `GET /api/admin/data`) stays `RUNNING`
through interim retries, recording the latest error on the row without
flipping its status. Only once all 5 attempts are exhausted does
`scripts/worker.ts`'s `Worker` `'failed'` listener mark the row `FAILED`
and write a `DeadLetterQueue` row — the same table
`scripts/retry_dead_letters.ts` already retries/archives (see
`src/lib/deadLetter.ts`), so a permanently-failed queue job and a
permanently-failed direct provider fetch end up in one place.

### 6.3 Running the worker

**Local dev** (two terminals):
```bash
# terminal 1
npm run dev
# terminal 2 — requires a local Redis (redis-server, or `docker run -p 6379:6379 redis`)
npm run worker
```

**Production** — run it as a second, always-on process next to
`next start`, under whatever process manager already runs this app
(pm2, systemd, or a second container in the same deployment). It is not
a request-driven process; it should just stay running.

pm2 example:
```bash
pm2 start "npm run worker" --name otakuva-worker
pm2 save
```

systemd example (`/etc/systemd/system/otakuva-worker.service`):
```ini
[Unit]
Description=OTAKUVA background job worker
After=network.target redis.service

[Service]
WorkingDirectory=/opt/otakuva
ExecStart=/usr/bin/npm run worker
Restart=always
RestartSec=5
EnvironmentFile=/opt/otakuva/.env

[Install]
WantedBy=multi-user.target
```

Docker Compose example (alongside the app and a Redis service):
```yaml
services:
  app:
    build: .
    command: npm start
    env_file: .env
    depends_on: [redis]
  worker:
    build: .
    command: npm run worker
    env_file: .env
    depends_on: [redis]
  redis:
    image: redis:7-alpine
    volumes: ["redis-data:/data"]
volumes:
  redis-data:
```

### 6.4 Environment

`REDIS_URL` (see `.env.example`) — defaults to `redis://127.0.0.1:6379` if
unset. Both the Next.js process (enqueues) and the worker process
(consumes) need it, pointed at the *same* Redis.

### 6.5 Operational notes

- **If the worker isn't running**: enqueue calls still succeed (they only
  need Redis, not the worker) — jobs pile up `PENDING` in both BullMQ and
  the `SyncJob` table. Nothing is lost; it just doesn't progress. Check
  `GET /api/admin/datacenter`'s `recentJobs` for a growing number of
  `PENDING` rows as the symptom.
- **If Redis is unreachable**: the enqueue side (`src/lib/queue/
  connection.ts`'s producer connection) fails fast (a few hundred ms,
  finite retries) rather than hanging the HTTP request — the route
  returns a 5xx and the `SyncJob` row it had already created is marked
  `FAILED` with the connection error, instead of sitting `PENDING`
  forever pretending to be queued. The worker's own connection retries
  indefinitely (BullMQ requirement for its blocking commands), and its
  startup registration of the recurring jobs retries a handful of times
  with backoff before giving up — so a worker that starts slightly before
  Redis does in a container/compose startup doesn't crash-loop.
- **Concurrency is 1** (`WORKER_CONCURRENCY` env var to change it) — every
  job kind here is a rate-limited external-provider crawl or a bulk DB
  pass; running two at once mostly adds provider request pressure without
  adding throughput. Raise it if that assumption stops holding for some
  job mix.
- **Anime import pause/cancel** (`POST /api/admin/anime/import
  {"action":"stop"|"cancel"}`) is cooperative — the running job notices
  between pages, not instantly (same granularity the old in-memory job
  runner had). The route returns right away with a "requested" message;
  poll `GET /api/admin/anime/import` for the job to actually reach
  `PAUSED`/`CANCELLED`.

---

## 7. Database: PostgreSQL

Migrated from SQLite (`prisma/dev.db`) to PostgreSQL on 2026-09-14.
`prisma/schema.prisma`'s datasource is `postgresql`; the SQLite-era
migration history (4 migrations, dating back to the original `db push`
baseline) was **not** replayed — it doesn't apply to Postgres (SQLite
`PRAGMA` statements, `RedefineTables` workarounds for SQLite's lack of
`ALTER COLUMN`, etc. — see the deleted migration files in git history if
you need them). Instead there's one fresh baseline migration,
`prisma/migrations/20260914130000_init_postgresql`, generated with
`prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
--script` against the final (already-postgresql) schema.

### 7.1 Local setup

1. Install PostgreSQL (this repo was migrated against PostgreSQL 18) and
   have it running.
2. Create a role and database for the app (as a Postgres superuser):
   ```sql
   CREATE ROLE otakuva WITH LOGIN PASSWORD '<pick a real password>' CREATEDB;
   CREATE DATABASE otakuva OWNER otakuva;
   ```
   `CREATEDB` is granted because `npm test` needs it (§7.3) — the running
   app itself never creates a database, only reads/writes tables in the
   one it's given.
3. Set `DATABASE_URL` in `.env` (see `.env.example`) to
   `postgresql://otakuva:<password>@<host>:5432/otakuva`.
4. Apply migrations: `npx prisma migrate deploy`.
5. Generate the client: `npx prisma generate`.

### 7.2 One-time data cutover (SQLite → Postgres)

If migrating an existing `prisma/dev.db` (rather than starting from an
empty Postgres database — step 4 above already leaves you with an empty
one), run the copy script **after** `prisma migrate deploy` has created
the (empty) schema and **before** anything else writes to the new
database:

```bash
PG_SUPERUSER_URL="postgresql://postgres:<superuser password>@<host>:5432/otakuva" \
  npx tsx scripts/migrate_sqlite_to_postgres.ts            # dry run — prints counts, writes nothing
PG_SUPERUSER_URL="postgresql://postgres:<superuser password>@<host>:5432/otakuva" \
  npx tsx scripts/migrate_sqlite_to_postgres.ts --apply    # actually copies every row
```

Needs a **superuser** connection string (separate from the app's own
`DATABASE_URL`/`otakuva` role) — see the script's header comment for why:
in short, it disables FK-enforcement triggers for the duration of the
load (`SET LOCAL session_replication_role = replica`) so all ~120 tables
can load in one pass without hand-sorting them by foreign-key dependency,
and only a superuser can do that. The whole copy runs in one transaction
(all-or-nothing) and the script verifies every table's row count matches
the source before declaring success. Refuses to run against a non-empty
target unless `--force` is also passed (which `TRUNCATE`s every target
table first — this is a one-time cutover tool, not a sync utility).

The 2026-09-14 migration copied 61,673 rows across 119 tables from the
then-current `prisma/dev.db`; every table's count matched afterward, FK
enforcement was confirmed back on post-migration, and spot-checked
relations (e.g. an anime's studio/genre joins) came through intact.
`prisma/dev.db` is kept around locally as the migration source / a
rollback reference — nothing reads it at runtime anymore.

### 7.3 Tests

`tests/helpers/setupTestDb.ts` creates a throwaway Postgres database
(`otakuva_test_<12 hex chars>`, via `CREATE DATABASE` through
`TEST_DATABASE_ADMIN_URL`) for each test file, pushes the schema into it
(`prisma db push`), and drops it again on process exit. A run that's
killed before its exit handler fires (Ctrl+C mid-run, OOM, a cancelled CI
job) leaves its database behind — harmless, but
`npx tsx scripts/reset_test_dbs.ts` sweeps up anything matching that
naming pattern.

`npm test` was run in full against real Postgres before this migration
was considered done — all 38 tests passed. One test's assumption was
SQLite-specific and got fixed rather than just noted: `tests/
authorization.test.ts`'s discussion-search test queried the same case as
its fixture title, so it never actually exercised case-insensitive
matching and wouldn't have caught Postgres's case-sensitive `contains` by
default — see CLAUDE.md's Phase 10 backlog entry on this migration for
the full case-sensitivity finding (`mode: 'insensitive'` needed and
missing in ~29 more files, 3 fixed — search and discussions — the rest
flagged for a case-by-case review).

### 7.4 Rollback

`prisma/dev.db` plus its pre-migration backup
(`prisma/dev.db.backup-pre-postgres-migration-*`, gitignored, kept
locally) are both still present after the cutover — reverting means
pointing `DATABASE_URL` back at `file:./prisma/dev.db` and reverting
`prisma/schema.prisma`'s datasource to `sqlite` (see git history for the
pre-migration version of both). Nothing about the migration is
destructive to the SQLite file itself — it's only ever read from, never
written to, by any of the scripts/process above.

---

## 8. Error Tracking (Sentry) & Structured Logging

### 8.1 Health check endpoints — which one is for what

`GET /api/health` and `GET /api/health/ready` serve different purposes on
purpose — don't point the same consumer at both expecting the same thing:

- **`GET /api/health`** — fast liveness only (`HealthService.getLiveness()`):
  always returns 200, never checks the database or any other dependency.
  This is what a k8s-style liveness probe (or anything whose failure mode
  is "restart the process") should hit — a liveness probe that depends on
  the database would restart a perfectly healthy app process during a
  transient DB blip, which is the wrong response to that failure.
- **`GET /api/health/ready`** — deep readiness
  (`HealthService.getReadiness()`): runs a real `SELECT 1`, checks memory
  pressure and cache health, returns 503 if the database is unreachable.
  **This is the one an external uptime monitor (Pingdom, UptimeRobot,
  Better Uptime, etc.) should be pointed at** — an uptime monitor's job is
  exactly "tell someone when the app can't actually serve real requests,"
  which is what a DB-down state means. `/api/health` would report 200
  straight through a full database outage and the monitor would never
  fire.

### 8.2 Sentry setup

`@sentry/nextjs` is wired into all three runtimes:

- `sentry.server.config.ts` / `sentry.edge.config.ts` (Node/Edge server
  runtimes, loaded by `src/instrumentation.ts`'s `register()` —
  requires `experimental.instrumentationHook: true` in `next.config.mjs`
  on Next.js 14.x)
- `src/instrumentation-client.ts` (browser, auto-loaded by Next.js)
- `src/app/global-error.tsx` (catches an error thrown in the root layout
  itself, the one class of client error nothing else here would catch)

All three are **no-ops until a DSN is set** (`SENTRY_DSN` server/edge,
`NEXT_PUBLIC_SENTRY_DSN` browser — see `.env.example`) — Sentry is
optional infrastructure the app runs identically without, never a hard
dependency. `next.config.mjs` also wraps the build with Sentry's webpack
plugin for source-map upload; without `SENTRY_ORG`/`SENTRY_PROJECT`/
`SENTRY_AUTH_TOKEN` set it just skips that step, the build itself doesn't
need them.

**What's captured, and what never is:**
- Unhandled exceptions everywhere a server request can throw — including
  ones that never reach an application `try`/`catch` — via Next.js's
  `onRequestError` hook (`src/instrumentation.ts`), and explicitly via
  `withApiHandler`'s catch block (`src/lib/api/apiHandler.ts`) and
  `src/lib/logger.ts`'s `error()` (see §8.3) for routes/lib code that use
  those.
- Request context: route, method, and (for `withApiHandler` routes) status
  — via `logger.error`'s `tags`.
- The authenticated user's **id only** — never email, username, or role —
  attached via `Sentry.setUser({id})` on every request through
  `withApiHandler` (`src/lib/observability/sentryUser.ts`, a local JWT
  verify, no DB round trip) and scrubbed to just `{id}` a second time in
  `beforeSend` even if something else ever sets more.
- **Never** secrets or tokens: `sendDefaultPii: false` on every `Sentry.
  init()` (no automatic cookie/IP/header collection to begin with), plus
  every event passes through `scrubSentryEvent`
  (`src/lib/observability/sentryScrub.ts`) before sending — a recursive
  walk that redacts any field whose key looks like a password, token,
  secret, API key, `Authorization`/`Cookie` header, or similar, anywhere
  in the payload (request data, extra context, breadcrumbs).

### 8.3 Structured logger

`src/lib/logger.ts` replaces ad-hoc `console.log`/`console.error`/
`console.warn` calls — one JSON line per call (`level`, `msg`, `time`,
plus whatever context is passed, redacted the same way as the Sentry
scrubber above), and `logger.child({route, method, ...})` (what
`withApiHandler` uses) carries that context onto every line from a
request without repeating it. `error()` always forwards to Sentry;
`warn()` only when called with `{toSentry: true}` — most `warn()` call
sites are routine, expected, already-handled conditions (a provider
retry, a skipped/unmatched record) that can fire thousands of times
during one degraded-provider run (see the Jikan-degradation notes in
CLAUDE.md) — reporting every one to Sentry would drown real signal and
burn quota on noise.

**Migration status**: converted so far — `src/lib/api/apiHandler.ts` (the
shared route wrapper, so every route using `withApiHandler` gets
structured logging automatically), `src/lib/queue/**`, `src/lib/
performance/cacheManager.ts`, `src/lib/syncEngine.ts`, `src/lib/
jikanService.ts`. The rest of `src/app/api/**` and `src/lib/**` (~280
files) still use `console.*` directly — not migrated in this pass (see
CLAUDE.md's Phase 10 backlog for why and the plan going forward). Use
`logger`, not `console.*`, in any file you touch from here.

### 8.4 Investigating a reported error

1. Check Sentry's issue stream, filtered by `route`/`method` tags if the
   report came from a specific endpoint.
2. Cross-reference the structured log line for the same request (same
   `time` window, same `route`) in whatever log aggregator reads this
   app's stdout/stderr — `latencyMs` and any extra context passed to that
   `logger` call are there even for things Sentry's event doesn't carry.
3. If it's a new regression tied to a release, see **SOP-02: Emergency
   Rollback**; if it's tied to an external provider, check `GET /api/
   admin/data`'s provider metrics and `DeadLetterQueue` (`scripts/
   retry_dead_letters.ts`) before assuming it's this app's bug.

## 9. Continuous Integration & Dependency Auditing

Added 2026-09-16 (`.github/workflows/ci.yml`, `.github/dependabot.yml`) —
this repo had no CI pipeline before this.

### 9.1 CI workflow

`.github/workflows/ci.yml` runs on every push to `main` and every PR, two
jobs:

- **`test`** (job name shown in the checks list: "typecheck, lint, test"):
  `npm run typecheck`, then `npm run lint`, then `npm test` against a
  throwaway Postgres database (a `postgres:16` service container, same
  `TEST_DATABASE_ADMIN_URL` contract as local dev — see §7.3). Blocking —
  any of the three failing fails the job.
- **`audit`**: `npm audit --audit-level=high`, currently `continue-on-error:
  true`. As of 2026-09-16 this already reports 5 high/1 critical findings
  — chiefly `next` itself (fixable only via a breaking upgrade to
  next@16.3.5), plus `postcss`/`js-yaml`. It's non-blocking for now so CI
  doesn't go red on every push over an upgrade nobody has scoped yet; the
  point until then is visibility — check this job's output on every run.
  **Flip `continue-on-error` to `false`/remove it once that Next.js
  upgrade lands.**

A workflow file alone makes checks *run*; it doesn't make them *required*
for merge. Once this repo has a GitHub remote, turn on branch protection
for `main` (Settings → Branches → add rule → require the "typecheck, lint,
test" status check to pass before merging) — that's the step that actually
blocks a PR with a failing check from being merged.

### 9.2 Dependabot

`.github/dependabot.yml` opens PRs weekly for outdated npm packages
(grouped into one batched PR for routine version bumps, security
advisories always get their own immediate PR per Dependabot's default
behavior) and GitHub Actions versions. Takes effect once this repo has a
GitHub remote — Dependabot is a GitHub-hosted feature, not something that
runs standalone.
