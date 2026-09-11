/**
 * OTAKUVA — restore provider score columns from the provider itself.
 *
 * Usage:
 *   npx tsx scripts/restore_provider_scores.ts            (dry run, default)
 *   npx tsx scripts/restore_provider_scores.ts --apply
 *
 * Why this exists (see docs/AUDIT_2026-09-11.md, findings 3 and 4):
 *   - recalculateAnimeAggregates() used to copy OTAKUVA's user-rating
 *     aggregate into Anime.score/scoredBy, overwriting the MAL figures.
 *   - scripts/repair_data_integrity.ts and the seed typed score/scoredBy
 *     values by hand with no provider fetch, and those rows have no
 *     DataSourceRecord to show where they came from.
 *
 * For every affected anime with a MAL id, this fetches /anime/{malId} through
 * the shared Jikan transport and writes back only the provider stat columns
 * (score, scoredBy, rank, popularity, members, favoritesCount). Each changed
 * field gets an AnimeMetadataHistory row, and the fetch is recorded as a
 * DataSourceRecord. Fields with an EditorialOverride are never touched.
 *
 * If the provider can't be reached, a row whose score is *known* to be a
 * copied user aggregate is cleared to null (missing is honest; a user
 * aggregate labelled as the MAL score is not). Anything else is left alone
 * and reported for a later run.
 *
 * Never touches user data (ratings, library, reviews) — only Anime columns.
 */

import crypto from 'crypto';
import { prisma } from '../src/lib/prisma';
import { jikanFetch } from '../src/lib/jikanService';

const APPLY = process.argv.includes('--apply');
const STAT_FIELDS = ['score', 'scoredBy', 'rank', 'popularity', 'members', 'favoritesCount'] as const;
type StatField = (typeof STAT_FIELDS)[number];

async function main() {
  console.log(`restore_provider_scores — ${APPLY ? 'APPLY' : 'DRY RUN (pass --apply to write)'}\n`);

  const [animeRows, aggregates, provenance, overrides] = await Promise.all([
    prisma.anime.findMany({
      select: { id: true, slug: true, malId: true, score: true, scoredBy: true, rank: true, popularity: true, members: true, favoritesCount: true },
    }),
    prisma.ratingAggregate.findMany({ select: { animeId: true, bayesianScore: true, ratingCount: true } }),
    prisma.dataSourceRecord.findMany({ where: { entityType: 'ANIME', provider: 'jikan' }, select: { entityId: true } }),
    prisma.editorialOverride.findMany({ where: { entityType: 'ANIME' }, select: { entityId: true, field: true } }),
  ]);

  const aggByAnime = new Map(aggregates.map((a) => [a.animeId, a]));
  const hasProvenance = new Set(provenance.map((p) => p.entityId));
  const overridden = new Set(overrides.map((o) => `${o.entityId}:${o.field}`));

  const targets = animeRows
    .map((a) => {
      const agg = aggByAnime.get(a.id);
      const copiedAggregate = Boolean(
        agg && agg.bayesianScore !== null && a.score !== null &&
        Math.abs(a.score - agg.bayesianScore) < 0.005 && a.scoredBy === agg.ratingCount
      );
      const noProvenance = !hasProvenance.has(a.id);
      return { ...a, copiedAggregate, noProvenance };
    })
    .filter((a) => a.copiedAggregate || a.noProvenance);

  console.log(`${targets.length} anime need attention (${targets.filter((t) => t.copiedAggregate).length} with a copied user aggregate, ${targets.filter((t) => t.noProvenance).length} without provider provenance)\n`);

  const summary = { restored: 0, cleared: 0, unchanged: 0, skippedNoMalId: 0, providerFailed: 0 };

  for (const a of targets) {
    const why = [a.copiedAggregate && 'copied-user-aggregate', a.noProvenance && 'no-provenance'].filter(Boolean).join(',');

    if (!a.malId) {
      summary.skippedNoMalId++;
      console.log(`- ${a.slug} [${why}] no MAL id — cannot verify against a provider; left for manual review`);
      continue;
    }

    const res = await jikanFetch<{ data: any }>(`/anime/${a.malId}`);
    const data = res?.data;

    if (!data || data.mal_id !== a.malId) {
      summary.providerFailed++;
      if (a.copiedAggregate) {
        console.log(`- ${a.slug} [${why}] provider unavailable — clearing copied aggregate (score ${a.score}, scoredBy ${a.scoredBy} → null)`);
        if (APPLY) await writeChanges(a.id, { score: null, scoredBy: null }, a, overridden, 'restore:clear-copied-aggregate');
        summary.cleared++;
      } else {
        console.log(`- ${a.slug} [${why}] provider unavailable — left unchanged, rerun later`);
      }
      continue;
    }

    const next: Partial<Record<StatField, number | null>> = {
      score: typeof data.score === 'number' ? data.score : null,
      scoredBy: typeof data.scored_by === 'number' ? data.scored_by : null,
      rank: typeof data.rank === 'number' ? data.rank : null,
      popularity: typeof data.popularity === 'number' ? data.popularity : null,
      members: typeof data.members === 'number' ? data.members : null,
      favoritesCount: typeof data.favorites === 'number' ? data.favorites : null,
    };

    const diff = STAT_FIELDS.filter((f) => (a as any)[f] !== next[f] && !overridden.has(`${a.id}:${f}`));
    if (diff.length === 0) {
      summary.unchanged++;
      console.log(`- ${a.slug} [${why}] already matches MAL`);
    } else {
      summary.restored++;
      console.log(`- ${a.slug} [${why}] ${diff.map((f) => `${f}: ${(a as any)[f]} → ${next[f]}`).join(', ')}`);
    }

    if (APPLY) {
      await writeChanges(a.id, next, a, overridden, 'jikan:restore');
      const payload = JSON.stringify(data);
      await prisma.dataSourceRecord.upsert({
        where: { entityType_entityId_provider: { entityType: 'ANIME', entityId: a.id, provider: 'jikan' } },
        create: {
          entityType: 'ANIME', entityId: a.id, provider: 'jikan', externalId: String(a.malId),
          rawHash: crypto.createHash('md5').update(payload).digest('hex'), payload,
        },
        update: {
          externalId: String(a.malId), rawHash: crypto.createHash('md5').update(payload).digest('hex'),
          payload, retrievedAt: new Date(), lastVerifiedAt: new Date(),
        },
      });
    }
  }

  console.log('\nSummary:', summary);
  if (!APPLY) console.log('Dry run — nothing was written.');
}

async function writeChanges(
  animeId: string,
  next: Partial<Record<StatField, number | null>>,
  current: Record<string, any>,
  overridden: Set<string>,
  source: string
) {
  const data: Record<string, number | null> = {};
  for (const f of STAT_FIELDS) {
    if (!(f in next) || overridden.has(`${animeId}:${f}`)) continue;
    if (current[f] === next[f]) continue;
    data[f] = next[f] ?? null;
  }
  if (Object.keys(data).length === 0) return;

  await prisma.$transaction([
    prisma.anime.update({ where: { id: animeId }, data }),
    ...Object.entries(data).map(([field, value]) =>
      prisma.animeMetadataHistory.create({
        data: {
          animeId, field, source,
          oldValue: current[field] === null || current[field] === undefined ? null : String(current[field]),
          newValue: value === null ? null : String(value),
        },
      })
    ),
  ]);
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
