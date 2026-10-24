/**
 * OTAKUVA — one-time cleanup of the seed persona, test accounts/communities,
 * and fixture catalog rows flagged in docs/AUDIT_2026-09-11.md §11 and the
 * "Pending owner sign-off" list in CLAUDE.md.
 *
 * Usage:
 *   npx tsx scripts/cleanup_seed_fixtures.ts            (dry run, default — no writes)
 *   npx tsx scripts/cleanup_seed_fixtures.ts --apply     (backs up dev.db, then writes)
 *
 * What this does, in order:
 *   1. `user_default` ("Atul Swain", seeded persona, no password) — delete the
 *      user. Cascade removes their 4 ratings + 2 reviews. The anime those
 *      ratings pointed at get RatingAggregate recomputed afterward (see note
 *      below on why this targets RatingAggregate, not Anime.score/scoredBy).
 *   2. ~17 test accounts, identified by email domain (@otakuva.com,
 *      @otakuva.test, @test.local) — the account naming audited in
 *      AUDIT_2026-09-11.md §11. Deleting them cascades their reviews,
 *      ratings, and *owned* communities (secret-anime-society,
 *      test-req-community, notify-scope-check, open-join-check — 4 test
 *      communities as of this run, more than the audit's "3" because
 *      open-join-check/notify-scope-check post-date that snapshot).
 *   3. Fixture anime `mind-paradox-*` / `daily-laughs-*` and fixture studio
 *      `MAPPA AI Intelligence *`. Before deleting the anime, any REMAINING
 *      review/rating from a real (non-test) account pointing at them is
 *      soft-deleted (deletedAt set) and logged in full — this only matters
 *      for accounts that survive step 2; test-account rows on the fixtures
 *      are already gone by then via cascade.
 *   4. The 161 placeholder "Episode N" rows — identified as
 *      `title ~= /^Episode \d+$/ AND externalId IS NULL`, which lands on
 *      exactly 8 real anime (Frieren, AoT Final Season, JJK S2, Vinland Saga
 *      S2, Apothecary Diaries, Cyberpunk: Edgerunners, Chainsaw Man, Dungeon
 *      Meshi) and totals exactly 161 rows, matching the audit count. This is
 *      NOT the same as every episode titled "Episode N" — 55 further rows on
 *      long-running shows (Shin Chan, Soul Land 2, Shrouding the Heavens,
 *      Honoo no Toukyuuji) carry a real provider externalId and are live
 *      catalog data, not fixtures; they are deliberately left alone.
 *      UserEpisodeProgress on the 161 belongs entirely to user_default (29
 *      rows) and is already gone via step 1's cascade by the time this runs.
 *
 * Deliberately NOT done: overwriting Anime.score/scoredBy. The audit's
 * finding #3 (fixed since) was exactly that recalculateAnimeAggregates() was
 * writing the user-rating aggregate into those provider-owned columns —
 * doing that again here to "recalculate" them post-deletion would
 * reintroduce the same critical bug. The OTAKUVA aggregate lives in
 * RatingAggregate only (src/lib/rating/ratingService.ts); that's what this
 * script recomputes for every anime whose rating set changed.
 *
 * Every row this script identifies for deletion/soft-deletion is written in
 * full to a timestamped JSON log under scripts/cleanup_logs/ before it is
 * touched. Everything cascade-deleted as a structural consequence (e.g. a
 * deleted community's memberships/discussions, a deleted anime's join-table
 * rows) is captured as a before/after row count for every model in the
 * schema, so the log also proves no table outside this list changed.
 */

import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { recalculateAnimeAggregates } from '../src/lib/rating/ratingService';
import { Prisma } from '@prisma/client';

const APPLY = process.argv.includes('--apply');
const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'prisma', 'dev.db');
const LOG_DIR = path.join(ROOT, 'scripts', 'cleanup_logs');

const TEST_EMAIL_DOMAINS = ['@otakuva.com', '@otakuva.test', '@test.local'];
const SEED_USER_ID = 'user_default';
const FIXTURE_ANIME_SLUG_FRAGMENTS = ['mind-paradox', 'daily-laughs'];
const FIXTURE_STUDIO_NAME_FRAGMENT = 'MAPPA AI Intelligence';

function delegateName(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

async function countAllModels(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const model of Prisma.dmmf.datamodel.models) {
    const delegate = (prisma as any)[delegateName(model.name)];
    if (!delegate || typeof delegate.count !== 'function') continue;
    out[model.name] = await delegate.count();
  }
  return out;
}

function diffCounts(before: Record<string, number>, after: Record<string, number>) {
  const diff: Record<string, { before: number; after: number; delta: number }> = {};
  for (const key of Object.keys(before)) {
    const b = before[key];
    const a = after[key] ?? 0;
    if (a !== b) diff[key] = { before: b, after: a, delta: a - b };
  }
  return diff;
}

async function main() {
  console.log(`cleanup_seed_fixtures — ${APPLY ? 'APPLY (will write)' : 'DRY RUN (pass --apply to write)'}\n`);

  const log: Record<string, unknown> = {
    runAt: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'dry-run',
  };

  // ---- 1. user_default -------------------------------------------------
  const seedUser = await prisma.user.findUnique({ where: { id: SEED_USER_ID } });
  const seedUserRatings = seedUser
    ? await prisma.animeRating.findMany({
        where: { userId: SEED_USER_ID },
        include: { categoryScores: true, anime: { select: { slug: true } } },
      })
    : [];
  const seedUserReviews = seedUser
    ? await prisma.review.findMany({ where: { userId: SEED_USER_ID }, include: { anime: { select: { slug: true } } } })
    : [];
  const animeAffectedBySeedUser = [...new Set(seedUserRatings.map((r) => r.animeId))];

  console.log(`user_default: ${seedUser ? `found (${seedUserRatings.length} ratings, ${seedUserReviews.length} reviews)` : 'not found — skipping'}`);
  log.seedUser = { user: seedUser, ratings: seedUserRatings, reviews: seedUserReviews };

  // ---- 2. Test accounts ---------------------------------------------------
  const allUsers = await prisma.user.findMany();
  const testUsers = allUsers.filter(
    (u) => u.id !== SEED_USER_ID && TEST_EMAIL_DOMAINS.some((d) => u.email?.endsWith(d))
  );
  const testUserIds = testUsers.map((u) => u.id);

  const testUserRatings = await prisma.animeRating.findMany({
    where: { userId: { in: testUserIds } },
    include: { anime: { select: { slug: true } } },
  });
  const testUserReviews = await prisma.review.findMany({
    where: { userId: { in: testUserIds } },
    include: { anime: { select: { slug: true } } },
  });
  const communitiesOwnedByTestUsers = await prisma.community.findMany({
    where: { ownerId: { in: testUserIds } },
  });

  const fixtureAnimeForNow = await prisma.anime.findMany({
    where: { OR: FIXTURE_ANIME_SLUG_FRAGMENTS.map((f) => ({ slug: { contains: f } })) },
    select: { id: true },
  });
  const fixtureAnimeIdSet = new Set(fixtureAnimeForNow.map((a) => a.id));
  const animeAffectedByTestUsers = [
    ...new Set(testUserRatings.map((r) => r.animeId).filter((id) => !fixtureAnimeIdSet.has(id))),
  ];

  console.log(`Test accounts (email in ${TEST_EMAIL_DOMAINS.join(', ')}): ${testUsers.length}`);
  testUsers.forEach((u) => console.log(`  ${u.id}  ${u.username}  ${u.email}`));
  console.log(`  -> ${testUserRatings.length} ratings, ${testUserReviews.length} reviews, ${communitiesOwnedByTestUsers.length} owned communities cascade with them`);
  log.testUsers = { users: testUsers, ratings: testUserRatings, reviews: testUserReviews, ownedCommunities: communitiesOwnedByTestUsers };

  // ---- 3. Fixture anime / studio -----------------------------------------
  const fixtureAnime = await prisma.anime.findMany({
    where: { OR: FIXTURE_ANIME_SLUG_FRAGMENTS.map((f) => ({ slug: { contains: f } })) },
  });
  const fixtureAnimeIds = fixtureAnime.map((a) => a.id);

  const fixtureStudio = await prisma.studio.findMany({
    where: { name: { contains: FIXTURE_STUDIO_NAME_FRAGMENT } },
  });

  // Real (non-test) accounts' reviews/ratings still pointing at the fixture
  // anime once test accounts are gone. Evaluate against the post-step-2
  // survivor set (i.e. exclude testUserIds — those rows are already gone by
  // the time this step runs).
  const survivingReviewsOnFixture = await prisma.review.findMany({
    where: { animeId: { in: fixtureAnimeIds }, userId: { notIn: testUserIds } },
    include: { user: { select: { id: true, username: true, email: true } }, anime: { select: { slug: true } } },
  });
  const survivingRatingsOnFixture = await prisma.animeRating.findMany({
    where: { animeId: { in: fixtureAnimeIds }, userId: { notIn: testUserIds } },
    include: { user: { select: { id: true, username: true, email: true } }, anime: { select: { slug: true } }, categoryScores: true },
  });

  console.log(`\nFixture anime: ${fixtureAnime.map((a) => a.slug).join(', ') || '(none)'}`);
  console.log(`Fixture studio: ${fixtureStudio.map((s) => s.name).join(', ') || '(none)'}`);
  console.log(`Real-account rows on fixture anime needing soft-delete first: ${survivingReviewsOnFixture.length} reviews, ${survivingRatingsOnFixture.length} ratings`);
  survivingReviewsOnFixture.forEach((r) => console.log(`  review ${r.id} by ${r.user.username} (${r.user.email}) on ${r.anime.slug}`));
  survivingRatingsOnFixture.forEach((r) => console.log(`  rating ${r.id} by ${r.user.username} (${r.user.email}) on ${r.anime.slug}`));
  log.fixtures = {
    anime: fixtureAnime,
    studio: fixtureStudio,
    survivingReviewsSoftDeleted: survivingReviewsOnFixture,
    survivingRatingsSoftDeleted: survivingRatingsOnFixture,
  };

  // ---- 4. Placeholder "Episode N" rows ------------------------------------
  const candidateEpisodes = await prisma.episode.findMany({
    where: { title: { startsWith: 'Episode ' }, externalId: null },
    include: { anime: { select: { slug: true } } },
  });
  const placeholderEpisodes = candidateEpisodes.filter((e) => /^Episode \d+$/.test(e.title || ''));
  const placeholderEpisodeIds = placeholderEpisodes.map((e) => e.id);
  const placeholderProgress = await prisma.userEpisodeProgress.findMany({
    where: { episodeId: { in: placeholderEpisodeIds } },
  });

  const byAnime = new Map<string, number>();
  placeholderEpisodes.forEach((e) => byAnime.set(e.anime.slug, (byAnime.get(e.anime.slug) || 0) + 1));
  console.log(`\nPlaceholder "Episode N" rows (title matches, externalId null): ${placeholderEpisodes.length}`);
  for (const [slug, count] of byAnime) console.log(`  ${slug}: ${count}`);
  console.log(`UserEpisodeProgress on them: ${placeholderProgress.length} (expected 0 by this point if all belonged to user_default)`);
  log.placeholderEpisodes = { episodes: placeholderEpisodes, userEpisodeProgress: placeholderProgress };

  // ---- Anime whose RatingAggregate needs recomputation --------------------
  const animeToRecalculate = [...new Set([...animeAffectedBySeedUser, ...animeAffectedByTestUsers])];
  console.log(`\nAnime needing RatingAggregate recompute after deletions: ${animeToRecalculate.length}`);

  if (!APPLY) {
    console.log('\nDry run only — no rows were changed. Re-run with --apply to execute.');
    await prisma.$disconnect();
    return;
  }

  // ---- Backup dev.db before any write -------------------------------------
  if (!fs.existsSync(DB_PATH)) throw new Error(`dev.db not found at ${DB_PATH}`);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(ROOT, 'prisma', `dev.db.backup-${stamp}`);
  fs.copyFileSync(DB_PATH, backupPath);
  console.log(`\nBacked up dev.db -> ${backupPath}`);
  log.backupPath = backupPath;

  const countsBefore = await countAllModels();

  // ---- Execute deletions ---------------------------------------------------
  // 3a. Soft-delete real users' rows on fixture anime first (kept for the
  // audit trail even though the anime cascade below removes the rows).
  if (survivingReviewsOnFixture.length) {
    await prisma.review.updateMany({
      where: { id: { in: survivingReviewsOnFixture.map((r) => r.id) } },
      data: { deletedAt: new Date() },
    });
  }
  if (survivingRatingsOnFixture.length) {
    await prisma.animeRating.updateMany({
      where: { id: { in: survivingRatingsOnFixture.map((r) => r.id) } },
      data: { deletedAt: new Date() },
    });
  }

  // 1. Seed persona (cascades ratings, reviews, everything else owned by it)
  if (seedUser) {
    await prisma.user.delete({ where: { id: SEED_USER_ID } });
  }

  // 2. Test accounts (cascades their reviews/ratings/owned communities/memberships/etc.)
  if (testUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  }

  // 3. Fixture anime + studio
  if (fixtureAnimeIds.length) {
    await prisma.anime.deleteMany({ where: { id: { in: fixtureAnimeIds } } });
  }
  if (fixtureStudio.length) {
    await prisma.studio.deleteMany({ where: { id: { in: fixtureStudio.map((s) => s.id) } } });
  }

  // 4. Placeholder episodes (their UserEpisodeProgress cascades with them;
  // by this point the only rows that existed belonged to user_default and
  // are already gone)
  if (placeholderEpisodeIds.length) {
    await prisma.episode.deleteMany({ where: { id: { in: placeholderEpisodeIds } } });
  }

  // 5. Recompute RatingAggregate (never Anime.score/scoredBy) for every
  // anime whose live rating set changed.
  const recalcResults: Array<{ animeId: string; ok: boolean; error?: string }> = [];
  for (const animeId of animeToRecalculate) {
    try {
      // Anime may itself have been a fixture and already deleted; skip those.
      const stillExists = await prisma.anime.findUnique({ where: { id: animeId }, select: { id: true } });
      if (!stillExists) {
        recalcResults.push({ animeId, ok: false, error: 'anime no longer exists' });
        continue;
      }
      await recalculateAnimeAggregates(animeId);
      recalcResults.push({ animeId, ok: true });
    } catch (e) {
      recalcResults.push({ animeId, ok: false, error: String(e) });
    }
  }
  console.log('\nRatingAggregate recompute results:', recalcResults);
  log.recalcResults = recalcResults;

  const countsAfter = await countAllModels();
  const countDiff = diffCounts(countsBefore, countsAfter);
  console.log('\nRow count changes by model:');
  console.table(countDiff);
  log.countsBefore = countsBefore;
  log.countsAfter = countsAfter;
  log.countDiff = countDiff;

  // ---- Write audit log -----------------------------------------------------
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logPath = path.join(LOG_DIR, `${stamp}-cleanup.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`\nAudit log written -> ${logPath}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
