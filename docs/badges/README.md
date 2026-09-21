# Reviewer badges

Hanko-style seals earned by counted written reviews. Nine tiers, Shoshinsha
(default) to Densetsu. Not a star system; no metal names anywhere.

## Where things live

| Concern | File |
|---|---|
| Tier names, kanji, thresholds, colours (single source of truth) | `src/lib/badges/tiers.ts` |
| Which reviews count, spam limits, gates, critics, ranking, job cadence | `src/lib/badges/config.ts` |
| Display strings (i18n-ready) | `src/lib/badges/strings.ts` |
| Pure rules (eligibility, cap, spam, tier resolution) | `src/lib/badges/rules.ts` |
| DB pipeline (maturation, recalculation, events, aggregates) | `src/lib/badges/countingService.ts` |
| Outlined kanji (generated) | `src/lib/badges/glyphPaths.ts` via `scripts/badges/build_glyphs.ts` |
| Components | `src/components/badges/` |
| Gallery (public) / lab (dev only) | `/badges`, `/badges/lab` |

Nothing else may hard-code a tier name, kanji, threshold or colour
(`tests/badge-components.test.ts` enforces it for the badge code).

## Changing the ladder
Edit `TIERS` in `tiers.ts`. If a `kanji` changed, run
`npx tsx scripts/badges/build_glyphs.ts` and commit `glyphPaths.ts`.
`chipFill` exists only because Kōhai/Buchō white text is under 4.5:1 on the
specified seal colours at 11px; seals keep the specified colours.

## Counting
`Review.countState`: `PENDING` -> `COUNTED` after `maturityHours` (48) and the
duplicate/spam check; `REMOVED` on failure or moderation; `INELIGIBLE` if it
never met the rules (under 40 words, no watching/completed entry, not an
anime-level review). Daily cap 5 per UTC day; overflow waits, it is not removed.
The star rating is never consulted. Quality gates live in `TIER_GATES`
(clean record from Senpai; helpful-vote floor from Sensei, **disabled**;
clean record + recent activity to *earn* Meijin and above). A held tier is
permanent unless removals drop the count below it or a confirmed-spam flag
appears. A review shows the reviewer's *current* tier.

## Running it
- Job: `badges:maturation` recurs every 15 min in `scripts/worker.ts` (needs Redis).
- By hand: `npx tsx scripts/badges/run_counting.ts backfill | mature [--no-cap] | rebuild`
- Moderation: `PATCH /api/admin/reviews` with `confirmSpam: true` removes the count and flags the user.
- Tests: `npx tsx --test tests/badge-*.test.ts` (or `npm test`).

## Placeholder data
`npx tsx scripts/badges/seed_sample.ts` seeds fictional users/anime/communities
(dev only; refuses `NODE_ENV=production`; rows tagged by `@placeholder.invalid`
emails, `placeholder-seed` anime source, `placeholder-` community slugs).
`--remove` deletes exactly those rows. `/badges/lab` 404s in production.

## Later (hooks left)
Specialty ("Tsu") and seasonal badges via `UserBadge`; yearly recap from
`BadgeEvent`/`UserBadgeStats`; enabling the helpful-vote floor.
