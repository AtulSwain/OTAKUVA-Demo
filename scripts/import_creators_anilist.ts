/**
 * OTAKUVA — CREATORS FROM ANILIST (credits + profile details)
 * Usage:
 *   npx tsx scripts/import_creators_anilist.ts            # dry run: report only
 *   npx tsx scripts/import_creators_anilist.ts --apply    # write
 *   options: --credits-only | --details-only | --extra
 *   --extra: only the profile facts added 2026-10-19 (alternative names,
 *            gender, blood type, language, AniList favourites) for every
 *            person with an AniList id not yet checked for them. Fills empty
 *            fields only; never overwrites. Re-run to resume.
 *
 * 1. Credits: for every anime with an AniList id, fetch its staff (25 anime
 *    per request) and link them. Anime that already have credits only get
 *    their people matched to AniList ids (no new credit rows), so the same
 *    job isn't listed twice under another provider's wording.
 * 2. Details: for every person with an AniList id whose details were never
 *    fetched, store bio (plain text, spoilers dropped), occupations,
 *    birthday, death date, home town, years active — filling empty fields
 *    only, never overwriting what's there. Resumable via
 *    Person.detailsFetchedAt.
 *
 * People are matched by provider id, never by name alone
 * (src/lib/people/personResolver.ts), so the same creator isn't added twice
 * and two different people with one name stay two people. Provenance:
 * DataSourceRecord (STAFF per anime, PERSON per person). Nothing invented —
 * a field AniList doesn't have stays null.
 */
import { prisma } from '../src/lib/prisma';
import { anilistProvider } from '../src/lib/providers/anilistProvider';
import { linkStaffToAnime } from '../src/lib/people/personResolver';
import { recordDataSourceProvenance } from '../src/lib/catalog/provenance';

const APPLY = process.argv.includes('--apply');
const EXTRA = process.argv.includes('--extra');
const CREDITS = !EXTRA && !process.argv.includes('--details-only');
const DETAILS = !EXTRA && !process.argv.includes('--credits-only');

const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function credits() {
  const anime = await prisma.anime.findMany({
    where: { status: { not: 'MERGED' }, anilistId: { not: null } },
    select: { id: true, anilistId: true, canonicalTitle: true, _count: { select: { staff: true } } },
    orderBy: [{ members: { sort: 'desc', nulls: 'last' } }],
  });
  const peopleBefore = await prisma.person.count();
  const creditsBefore = await prisma.animeStaff.count();
  let withNew = 0;
  let matchedOnly = 0;
  let noStaff = 0;
  let failedBatches = 0;
  let wouldAdd = 0;

  const batches = chunk(anime, 25);
  for (const [i, batch] of batches.entries()) {
    let map;
    try {
      map = await anilistProvider.getStaffByAnilistIds(batch.map((a) => a.anilistId!));
    } catch (err: any) {
      failedBatches++;
      console.warn(`  ! batch ${i + 1} failed: ${err?.message || err}`);
      continue;
    }
    for (const a of batch) {
      const staff = map.get(a.anilistId!) || [];
      if (staff.length === 0) { noStaff++; continue; }
      const hasCredits = a._count.staff > 0;
      if (!APPLY) {
        if (hasCredits) matchedOnly++; else { withNew++; wouldAdd += staff.length; }
        continue;
      }
      await linkStaffToAnime(a.id, staff, 'anilist', { addCredits: !hasCredits });
      await recordDataSourceProvenance('STAFF', a.id, 'anilist', String(a.anilistId));
      if (hasCredits) matchedOnly++; else withNew++;
    }
    if ((i + 1) % 10 === 0 || i === batches.length - 1) console.log(`  credits: ${i + 1}/${batches.length} batches`);
  }

  console.log('\n== Credits ==');
  console.log(`Anime checked:                      ${anime.length}`);
  console.log(`${APPLY ? 'Got' : 'Would get'} their first credits:          ${withNew}${APPLY ? '' : ` (~${wouldAdd} credits)`}`);
  console.log(`Already had credits (people matched): ${matchedOnly}`);
  console.log(`AniList lists no staff:              ${noStaff}`);
  if (failedBatches) console.log(`Failed batches (re-run to retry):     ${failedBatches}`);
  if (APPLY) {
    console.log(`People:  ${peopleBefore} → ${await prisma.person.count()}`);
    console.log(`Credits: ${creditsBefore} → ${await prisma.animeStaff.count()}`);
  }
}

async function details() {
  const people = await prisma.person.findMany({
    where: { anilistId: { not: null }, detailsFetchedAt: null },
    select: { id: true, anilistId: true, about: true, birthday: true, dateOfDeath: true, homeTown: true, yearsActive: true, occupations: true, nameKanji: true, imageUrl: true },
  });
  console.log(`\n== Details: ${people.length} people to fetch ==`);
  if (!APPLY) return;

  const stats = { updated: 0, bio: 0, birthday: 0, hometown: 0, occupations: 0, notReturned: 0, failedBatches: 0 };
  const batches = chunk(people, 50);
  for (const [i, batch] of batches.entries()) {
    let map;
    try {
      map = await anilistProvider.getStaffDetails(batch.map((p) => p.anilistId!));
    } catch (err: any) {
      stats.failedBatches++;
      console.warn(`  ! details batch ${i + 1} failed: ${err?.message || err}`);
      continue;
    }
    for (const p of batch) {
      const d = map.get(p.anilistId!);
      if (!d) { stats.notReturned++; continue; }
      const data: Record<string, unknown> = { detailsFetchedAt: new Date() };
      if (!p.about && d.about) { data.about = d.about; stats.bio++; }
      if (!p.birthday && d.dateOfBirth) { data.birthday = d.dateOfBirth; stats.birthday++; }
      if (!p.dateOfDeath && d.dateOfDeath) data.dateOfDeath = d.dateOfDeath;
      if (!p.homeTown && d.homeTown) { data.homeTown = d.homeTown; stats.hometown++; }
      if (!p.yearsActive && d.yearsActive) data.yearsActive = d.yearsActive;
      if (p.occupations.length === 0 && d.occupations.length) { data.occupations = d.occupations; stats.occupations++; }
      if (!p.nameKanji && d.nameNative) data.nameKanji = d.nameNative;
      if (!p.imageUrl && d.imageUrl) data.imageUrl = d.imageUrl;
      await prisma.person.update({ where: { id: p.id }, data });
      await recordDataSourceProvenance('PERSON', p.id, 'anilist', String(p.anilistId));
      stats.updated++;
    }
    if ((i + 1) % 10 === 0 || i === batches.length - 1) console.log(`  details: ${i + 1}/${batches.length} batches`);
  }
  console.log(`Profiles checked: ${stats.updated}; added bio ${stats.bio}, birthday ${stats.birthday}, home town ${stats.hometown}, occupations ${stats.occupations}`);
  if (stats.notReturned) console.log(`Not returned by AniList (left as is, re-run later): ${stats.notReturned}`);
  if (stats.failedBatches) console.log(`Failed batches (re-run to retry): ${stats.failedBatches}`);
}

async function extra() {
  const people = await prisma.person.findMany({
    where: { anilistId: { not: null }, extraDetailsFetchedAt: null },
    select: { id: true, anilistId: true, alternativeNames: true, gender: true, bloodType: true, language: true, anilistFavourites: true },
    // Best-known people first, so a partial run covers the pages people actually open.
    orderBy: { staffRoles: { _count: 'desc' } },
  });
  console.log(`\n== Extra profile facts: ${people.length} people to fetch ==`);
  if (!APPLY) return;

  const stats = { checked: 0, names: 0, gender: 0, blood: 0, language: 0, favourites: 0, notReturned: 0, failedBatches: 0 };
  const batches = chunk(people, 50);
  for (const [i, batch] of batches.entries()) {
    let map;
    try {
      map = await anilistProvider.getStaffDetails(batch.map((p) => p.anilistId!));
    } catch (err: any) {
      stats.failedBatches++;
      console.warn(`  ! batch ${i + 1} failed: ${err?.message || err}`);
      continue;
    }
    for (const p of batch) {
      const d = map.get(p.anilistId!);
      if (!d) { stats.notReturned++; continue; }
      const data: Record<string, unknown> = { extraDetailsFetchedAt: new Date() };
      if (p.alternativeNames.length === 0 && d.alternativeNames.length) { data.alternativeNames = d.alternativeNames; stats.names++; }
      if (!p.gender && d.gender) { data.gender = d.gender; stats.gender++; }
      if (!p.bloodType && d.bloodType) { data.bloodType = d.bloodType; stats.blood++; }
      if (!p.language && d.language) { data.language = d.language; stats.language++; }
      // Favourites is a live provider count, refreshed each time it's fetched.
      if (d.favourites !== null) { data.anilistFavourites = d.favourites; stats.favourites++; }
      await prisma.person.update({ where: { id: p.id }, data });
      await recordDataSourceProvenance('PERSON', p.id, 'anilist', String(p.anilistId));
      stats.checked++;
    }
    if ((i + 1) % 10 === 0 || i === batches.length - 1) console.log(`  extra: ${i + 1}/${batches.length} batches`);
  }
  console.log(`Checked ${stats.checked}; added alt names ${stats.names}, gender ${stats.gender}, blood type ${stats.blood}, language ${stats.language}, favourites ${stats.favourites}`);
  if (stats.notReturned) console.log(`Not returned by AniList (left as is, re-run later): ${stats.notReturned}`);
  if (stats.failedBatches) console.log(`Failed batches (re-run to retry): ${stats.failedBatches}`);
}

async function main() {
  console.log(APPLY ? 'APPLY' : 'DRY RUN');
  if (CREDITS) await credits();
  if (DETAILS) await details();
  if (EXTRA) await extra();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
