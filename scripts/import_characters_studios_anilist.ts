/**
 * OTAKUVA — CHARACTERS + VOICE CAST + STUDIO LINKS FROM ANILIST (2026-10-25)
 * Usage:
 *   npx tsx scripts/import_characters_studios_anilist.ts            # dry run: report only
 *   npx tsx scripts/import_characters_studios_anilist.ts --apply    # write
 *   options: --limit=N (anime to process), --studios-only
 *
 * Only 286 of ~18k anime had any characters (they came from Jikan, which is
 * down). For every anime with an AniList id this fetches (6 anime per
 * request, rate-limited by the provider):
 *   - Characters, main first, up to 50 per anime, with their Japanese voice
 *     actors — ONLY for anime that have no characters yet (anime that already
 *     have Jikan characters are left alone, so nobody is listed twice).
 *   - Animation studios — any studio link the anime is missing is added
 *     (main studio, or co-animation), so studio pages list all their works.
 *
 * Matching is by provider id, never by name alone:
 *   - Character.externalId = "anilist:<id>" (slug "<name>-c<id>"), so two
 *     different characters with one name stay two characters;
 *   - voice actors via personResolver (Person.anilistId);
 *   - studios via CanonicalStudioResolver (name / alias / redirect — the same
 *     resolver normal ingest uses), animation studios only.
 * Add-only: existing rows are never changed or removed. Provenance:
 * DataSourceRecord CHARACTER per anime that got characters. Resumable — anime
 * with AniList character provenance are skipped on the next run.
 * Log: scripts/import_logs/characters-studios-<time>.json (gitignored).
 */
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/prisma';
import { anilistProvider } from '../src/lib/providers/anilistProvider';
import { resolveStaffPerson } from '../src/lib/people/personResolver';
import { recordDataSourceProvenance } from '../src/lib/catalog/provenance';
import { CanonicalStudioResolver } from '../src/lib/catalog/canonicalStudioResolver';
import { generateSlug } from '../src/lib/normalizers';

const APPLY = process.argv.includes('--apply');
const STUDIOS_ONLY = process.argv.includes('--studios-only');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;
const BATCH = 6;

const isPlaceholder = (url?: string | null) => !url || /\/default\.(jpg|png)$|questionmark/i.test(url);
const ROLE: Record<string, string> = { MAIN: 'Main', SUPPORTING: 'Supporting', BACKGROUND: 'Background' };
const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function resolveCharacter(c: { id: number; name: string; native: string | null; image: string | null }): Promise<string> {
  const externalId = `anilist:${c.id}`;
  const existing = await prisma.character.findFirst({ where: { externalId }, select: { id: true } });
  if (existing) return existing.id;
  const base = generateSlug(c.name) || 'character';
  const created = await prisma.character.create({
    data: {
      externalId,
      name: c.name.trim(),
      slug: `${base}-c${c.id}`,
      nameKanji: c.native,
      imageUrl: isPlaceholder(c.image) ? null : c.image,
    },
    select: { id: true },
  });
  return created.id;
}

async function main() {
  const started = Date.now();
  const done = new Set(
    (await prisma.dataSourceRecord.findMany({ where: { entityType: 'CHARACTER', provider: 'anilist' }, select: { entityId: true } })).map((r) => r.entityId)
  );
  const all = await prisma.anime.findMany({
    where: { anilistId: { not: null } },
    select: { id: true, anilistId: true, canonicalTitle: true, _count: { select: { characters: true } } },
    orderBy: [{ members: { sort: 'desc', nulls: 'last' } }],
  });
  const anime = all.filter((a) => STUDIOS_ONLY || !done.has(a.id)).slice(0, LIMIT);
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${anime.length} anime to check (${done.size} already done earlier)`);

  const before = { characters: await prisma.character.count(), links: await prisma.animeCharacter.count(), studioLinks: await prisma.animeStudio.count() };
  const stats = { animeWithNewChars: 0, charLinks: 0, vaLinks: 0, studioLinksAdded: 0, skippedHadChars: 0, noData: 0, failedBatches: 0, moreThan50: 0 };
  const log: { anilistId: number; title: string; characters: number; studiosAdded: string[] }[] = [];

  const batches = chunk(anime, BATCH);
  for (const [i, batch] of batches.entries()) {
    let map;
    try {
      map = await anilistProvider.getCharactersAndStudiosByAnilistIds(batch.map((a) => a.anilistId!));
    } catch (err: any) {
      stats.failedBatches++;
      console.warn(`  ! batch ${i + 1} failed: ${err?.message || err}`);
      continue;
    }
    for (const a of batch) {
      const d = map.get(a.anilistId!);
      if (!d) {
        stats.noData++;
        continue;
      }
      const entry = { anilistId: a.anilistId!, title: a.canonicalTitle, characters: 0, studiosAdded: [] as string[] };

      // Studios: add any missing animation-studio link.
      for (const s of d.studios.filter((x) => x.isAnimationStudio)) {
        if (!APPLY) continue;
        const resolved = await CanonicalStudioResolver.resolveStudio(s.name);
        const exists = await prisma.animeStudio.findUnique({ where: { animeId_studioId: { animeId: a.id, studioId: resolved.studioId } }, select: { animeId: true } });
        if (exists) continue;
        await prisma.animeStudio.create({
          data: {
            animeId: a.id,
            studioId: resolved.studioId,
            role: s.isMain ? 'MAIN_STUDIO' : 'ANIMATION',
            isMain: s.isMain,
            isPrimary: s.isMain,
            source: 'ANILIST',
          },
        });
        stats.studioLinksAdded++;
        entry.studiosAdded.push(resolved.studioName);
      }

      // Characters: only for anime that have none yet.
      if (!STUDIOS_ONLY) {
        if (a._count.characters > 0) {
          stats.skippedHadChars++;
        } else if (d.characters.length > 0) {
          if (d.hasMoreCharacters) stats.moreThan50++;
          if (APPLY) {
            for (const c of d.characters) {
              const characterId = await resolveCharacter(c);
              const link = await prisma.animeCharacter.findUnique({ where: { animeId_characterId: { animeId: a.id, characterId } }, select: { animeId: true } });
              if (!link) {
                await prisma.animeCharacter.create({ data: { animeId: a.id, characterId, role: ROLE[c.role] ?? 'Supporting' } });
                stats.charLinks++;
              }
              for (const v of c.voiceActors) {
                const personId = await resolveStaffPerson(
                  { personExternalId: String(v.id), personName: v.name, personKanji: v.native, personImage: v.image, positions: [] } as any,
                  'anilist'
                );
                if (!personId) continue;
                const va = await prisma.characterVoiceActor.findUnique({
                  where: { characterId_personId_language: { characterId, personId, language: 'Japanese' } },
                  select: { id: true },
                });
                if (!va) {
                  await prisma.characterVoiceActor.create({ data: { characterId, personId, language: 'Japanese' } });
                  stats.vaLinks++;
                }
              }
            }
            await recordDataSourceProvenance('CHARACTER', a.id, 'anilist', String(a.anilistId));
          }
          stats.animeWithNewChars++;
          entry.characters = d.characters.length;
        }
      }
      if (entry.characters || entry.studiosAdded.length) log.push(entry);
    }
    if ((i + 1) % 25 === 0 || i === batches.length - 1) {
      const mins = ((Date.now() - started) / 60000).toFixed(1);
      console.log(`  ${i + 1}/${batches.length} batches · ${mins} min · anime with new characters ${stats.animeWithNewChars} · studio links +${stats.studioLinksAdded}`);
    }
  }

  console.log('\n== Characters + studios ==');
  console.log(stats);
  if (APPLY) {
    console.log(`Characters:      ${before.characters} → ${await prisma.character.count()}`);
    console.log(`Anime↔character: ${before.links} → ${await prisma.animeCharacter.count()}`);
    console.log(`Anime↔studio:    ${before.studioLinks} → ${await prisma.animeStudio.count()}`);
    const dir = path.join(__dirname, 'import_logs');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `characters-studios-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify({ stats, entries: log }, null, 2));
    console.log(`Log: ${file}`);
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
