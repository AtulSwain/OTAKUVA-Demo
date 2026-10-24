/**
 * OTAKUVA — backfill anime relations (sequels, prequels, side stories...)
 * from AniList. Dry run by default.
 *
 * Usage:
 *   npx tsx scripts/backfill_relations_anilist.ts                     # dry run
 *   npx tsx scripts/backfill_relations_anilist.ts --apply             # write relations
 *   npx tsx scripts/backfill_relations_anilist.ts --apply --ingest-missing [--max-new=150]
 *
 * Relations used to come only from Jikan's live /relations endpoint, which
 * has been 504ing (MAL-side), so the catalog had a single AnimeRelation row
 * and no anime could show its other seasons. AniList returns relations for
 * 50 anime per request — by AniList id, or MAL id for rows without one.
 *
 * - Only links where BOTH ends are in the catalog are written; nothing is
 *   invented for titles we don't hold.
 * - --ingest-missing adds missing *seasons* only: TV / TV_SHORT / ONA
 *   prequels and sequels (never adult), via the normal ingestAnime path with
 *   provenance, then repeats so their own sequels are found (max 4 passes).
 * - Upserts only; never deletes a relation.
 */
import { prisma } from '../src/lib/prisma';
import { anilistProvider } from '../src/lib/providers/anilistProvider';
import { syncEngine } from '../src/lib/syncEngine';

const APPLY = process.argv.includes('--apply');
const INGEST = process.argv.includes('--ingest-missing');
const MAX_NEW = Number(process.argv.find((a) => a.startsWith('--max-new='))?.split('=')[1] ?? 150);
const SEASON_FORMATS = new Set(['TV', 'TV_SHORT', 'ONA']);

// AniList enum -> the stored convention (see AnimeRelation in schema.prisma
// and INVERSE_RELATION in src/lib/animeData.ts).
const TYPE_MAP: Record<string, string> = {
  SEQUEL: 'Sequel',
  PREQUEL: 'Prequel',
  SIDE_STORY: 'Side story',
  PARENT: 'Parent story',
  SPIN_OFF: 'Spin-off',
  ALTERNATIVE: 'Alternative',
  SUMMARY: 'Summary',
  COMPILATION: 'Summary',
  CHARACTER: 'Character',
  OTHER: 'Other',
};

async function main() {
  let ingested = 0;
  let created = 0;
  let found = 0;
  // Keys: "a:<anilistId>" or "m:<malId>". AniList id first — titles imported
  // straight from AniList often have no MAL id at all.
  const processed = new Set<string>();

  for (let pass = 1; pass <= (INGEST ? 4 : 1); pass++) {
    const catalog = await prisma.anime.findMany({
      where: { status: { not: 'MERGED' } },
      select: { id: true, malId: true, anilistId: true },
    });
    const byMal = new Map(catalog.filter((a) => a.malId).map((a) => [a.malId as number, a.id]));
    const byAnilist = new Map(catalog.filter((a) => a.anilistId).map((a) => [a.anilistId as number, a.id]));
    const keyOf = (a: { anilistId: number | null; malId: number | null }) => (a.anilistId ? `a:${a.anilistId}` : a.malId ? `m:${a.malId}` : null);
    const pending = catalog.filter((a) => {
      const k = keyOf(a);
      return k && !processed.has(k);
    });
    const byAnilistTodo = pending.filter((a) => a.anilistId).map((a) => a.anilistId as number);
    const byMalTodo = pending.filter((a) => !a.anilistId && a.malId).map((a) => a.malId as number);
    const todo: Array<{ kind: 'anilist' | 'mal'; id: number }> = [
      ...byAnilistTodo.map((id) => ({ kind: 'anilist' as const, id })),
      ...byMalTodo.map((id) => ({ kind: 'mal' as const, id })),
    ];
    if (todo.length === 0) break;
    console.log(`Pass ${pass}: ${todo.length} anime to query (${byAnilistTodo.length} by AniList id, ${byMalTodo.length} by MAL id)`);

    const missingSeasons = new Map<number, number>(); // anilistId -> found from this source id
    for (let i = 0; i < todo.length; i += 50) {
      const chunk = todo.slice(i, i + 50);
      const kind = chunk[0].kind;
      const batch = chunk.filter((c) => c.kind === kind).map((c) => c.id);
      if (batch.length < chunk.length) i -= chunk.length - batch.length; // the rest start the next batch
      batch.forEach((id) => processed.add(`${kind === 'anilist' ? 'a' : 'm'}:${id}`));
      const rels = await anilistProvider.getRelationsByIds(batch, kind);
      for (const [sourceKey, edges] of Array.from(rels.entries())) {
        const sourceId = kind === 'anilist' ? byAnilist.get(sourceKey) : byMal.get(sourceKey);
        if (!sourceId) continue;
        for (const e of edges) {
          const relationType = TYPE_MAP[e.relationType];
          if (!relationType) continue; // ADAPTATION/SOURCE etc. point at manga/novels
          const targetId = (e.malId && byMal.get(e.malId)) || byAnilist.get(e.anilistId);
          if (!targetId) {
            if (
              INGEST &&
              !e.isAdult &&
              (e.relationType === 'SEQUEL' || e.relationType === 'PREQUEL') &&
              e.format &&
              SEASON_FORMATS.has(e.format)
            ) {
              missingSeasons.set(e.anilistId, sourceKey);
            }
            continue;
          }
          if (targetId === sourceId) continue;
          found++;
          if (APPLY) {
            const res = await prisma.animeRelation.upsert({
              where: { sourceAnimeId_targetAnimeId_relationType: { sourceAnimeId: sourceId, targetAnimeId: targetId, relationType } },
              update: {},
              create: { sourceAnimeId: sourceId, targetAnimeId: targetId, relationType },
              select: { id: true },
            });
            if (res) created++;
          }
        }
      }
      process.stdout.write(`  ${Math.min(i + 50, todo.length)}/${todo.length}\r`);
    }
    console.log(`  relations between catalog anime found so far: ${found}`);

    if (!INGEST || !APPLY || missingSeasons.size === 0) {
      if (INGEST && missingSeasons.size > 0) console.log(`  ${missingSeasons.size} missing seasons would be ingested (dry run).`);
      break;
    }
    let addedThisPass = 0;
    for (const anilistId of Array.from(missingSeasons.keys())) {
      if (ingested >= MAX_NEW) break;
      try {
        const pa = await anilistProvider.getAnime(String(anilistId));
        if (!pa || pa.isAdult) continue;
        const res = await syncEngine.ingestAnime(pa, 'anilist');
        if (res.isNew) {
          ingested++;
          addedThisPass++;
        }
      } catch (err: any) {
        console.warn(`  ingest failed for AniList ${anilistId}: ${err?.message}`);
      }
    }
    console.log(`  ingested ${addedThisPass} missing seasons (total ${ingested}/${MAX_NEW})`);
    if (addedThisPass === 0 || ingested >= MAX_NEW) {
      // One more pass still links the newly added ones; then stop.
      if (pass >= 2 || addedThisPass === 0) break;
    }
  }

  console.log(
    APPLY
      ? `Done: ${created} relation rows upserted, ${ingested} missing seasons ingested.`
      : `Dry run: ${found} relations would be written. Re-run with --apply.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
