/**
 * OTAKUVA — CATALOG DUPLICATE AUDIT (read-only)
 * Usage: npx tsx scripts/audit_catalog_duplicates.ts
 *
 * Reports anime (and people) that look like the same entry stored twice:
 *   1. the same MyAnimeList id on more than one row (certain duplicate)
 *   2. the same AniList id on more than one row (certain duplicate)
 *   3. the same normalized title + format + year (likely duplicate — review)
 * MERGED rows are ignored (they're already resolved). Writes nothing; real
 * duplicates go to the existing PotentialDuplicate / merge review flow.
 */
import { prisma } from '../src/lib/prisma';

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

async function main() {
  const rows = await prisma.anime.findMany({
    where: { status: { not: 'MERGED' } },
    select: { id: true, slug: true, canonicalTitle: true, malId: true, anilistId: true, type: true, year: true, startYear: true },
  });

  const group = <K>(key: (r: (typeof rows)[number]) => K | null) => {
    const m = new Map<K, typeof rows>();
    for (const r of rows) {
      const k = key(r);
      if (k === null || k === undefined) continue;
      m.set(k, [...(m.get(k) || []), r]);
    }
    return [...m.entries()].filter(([, v]) => v.length > 1);
  };

  const byMal = group((r) => r.malId);
  const byAnilist = group((r) => r.anilistId);
  const byTitle = group((r) => `${norm(r.canonicalTitle)}|${r.type ?? ''}|${r.year ?? r.startYear ?? ''}`);

  const show = (label: string, groups: [unknown, typeof rows][]) => {
    console.log(`\n${label}: ${groups.length}`);
    for (const [k, v] of groups.slice(0, 40)) {
      console.log(`  ${k}`);
      for (const r of v) console.log(`    - ${r.slug}  (mal ${r.malId ?? '-'}, anilist ${r.anilistId ?? '-'}, ${r.type ?? '?'} ${r.year ?? r.startYear ?? '?'})`);
    }
  };

  console.log(`Anime rows checked: ${rows.length}`);
  show('Same MAL id on several rows', byMal);
  show('Same AniList id on several rows', byAnilist);
  show('Same title + format + year (review)', byTitle);

  // People: provider ids are unique columns, so the same AniList/MAL person
  // can't be stored twice. What can exist is two *provider* entries with the
  // same name and native name — sometimes one person listed twice upstream,
  // often two different people with a common name. Listed for review only;
  // merging needs a human (they may have different credits for a reason).
  const people = await prisma.person.findMany({
    select: { slug: true, name: true, nameKanji: true, anilistId: true, malId: true, _count: { select: { staffRoles: true, voiceRoles: true } } },
  });
  const peopleGroups = new Map<string, typeof people>();
  for (const p of people) {
    if (!p.nameKanji) continue;
    const k = `${norm(p.name)}|${p.nameKanji}`;
    peopleGroups.set(k, [...(peopleGroups.get(k) || []), p]);
  }
  const samePerson = [...peopleGroups.values()].filter((g) => g.length > 1);
  console.log(`\nPeople checked: ${people.length}`);
  console.log(`Same name + native name under different ids (review): ${samePerson.length}`);
  for (const g of samePerson.slice(0, 40)) {
    console.log(`  ${g[0].name} (${g[0].nameKanji})`);
    for (const p of g) console.log(`    - /person/${p.slug}  (anilist ${p.anilistId ?? '-'}, mal ${p.malId ?? '-'}, ${p._count.staffRoles} credits, ${p._count.voiceRoles} voice roles)`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
