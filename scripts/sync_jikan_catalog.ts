/**
 * OTAKUVA — JIKAN V4 CATALOG INGESTION & ENRICHMENT SCRIPT
 * Usage: npx tsx scripts/sync_jikan_catalog.ts
 * 
 * Fetches top-rated, popular, and seasonal anime from Jikan v4,
 * normalizes titles, upserts studios, characters, staff, and episodes into the database.
 */

import { prisma } from '../src/lib/prisma';
import {
  getJikanTopAnime,
  getJikanCurrentSeason,
  getJikanAnimeCharacters,
  getJikanAnimeStaff,
  syncJikanAnimeToDatabase,
} from '../src/lib/jikanService';

async function main() {
  console.log('========================================================================');
  console.log('  OTAKUVA — JIKAN V4 PRODUCTION CATALOG SYNC');
  console.log('========================================================================\n');

  console.log('1. Fetching Top Anime from Jikan v4...');
  const topRes = await getJikanTopAnime(1, 20);
  console.log(`   Found ${topRes.animes.length} top anime from Jikan.`);

  console.log('2. Fetching Current Seasonal Anime from Jikan v4...');
  const seasonRes = await getJikanCurrentSeason(1, 20);
  console.log(`   Found ${seasonRes.animes.length} seasonal anime from Jikan.`);

  const allJikanItems = [...topRes.animes, ...seasonRes.animes];
  const uniqueMalIds = new Set<number>();
  const distinctAnimes: any[] = [];

  allJikanItems.forEach((item) => {
    if (!uniqueMalIds.has(item.mal_id)) {
      uniqueMalIds.add(item.mal_id);
      distinctAnimes.push(item);
    }
  });

  console.log(`\n3. Ingesting & Syncing ${distinctAnimes.length} distinct anime titles into database...`);

  let syncedCount = 0;
  for (const item of distinctAnimes.slice(0, 15)) {
    const animeId = await syncJikanAnimeToDatabase(item);
    if (animeId) {
      syncedCount++;
      console.log(`   ✓ Synced: "${item.title}" (MAL ID: ${item.mal_id}) -> Anime ID: ${animeId}`);

      // Sync Characters for Top 5 anime to demonstrate deep enrichment
      if (syncedCount <= 5) {
        try {
          const chars = await getJikanAnimeCharacters(item.mal_id);
          for (const c of chars.slice(0, 6)) {
            const charSlug = c.name.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
            const dbChar = await prisma.character.upsert({
              where: { slug: charSlug },
              update: { name: c.name, imageUrl: c.imageUrl },
              create: { slug: charSlug, name: c.name, imageUrl: c.imageUrl },
            });
            await prisma.animeCharacter.upsert({
              where: { animeId_characterId: { animeId, characterId: dbChar.id } },
              update: { role: c.role },
              create: { animeId, characterId: dbChar.id, role: c.role },
            }).catch(() => {});
          }
          console.log(`     + Synced ${Math.min(chars.length, 6)} characters`);
        } catch (e) {
          console.warn(`     ! Could not sync characters for ${item.title}`);
        }

        // Sync Staff for Top 5 anime
        try {
          const staffList = await getJikanAnimeStaff(item.mal_id);
          for (const s of staffList.slice(0, 5)) {
            const personSlug = s.person.name.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
            const dbPerson = await prisma.person.upsert({
              where: { slug: personSlug },
              update: { name: s.person.name, imageUrl: s.person.imageUrl },
              create: { slug: personSlug, name: s.person.name, imageUrl: s.person.imageUrl },
            });
            
            const existingStaff = await prisma.animeStaff.findFirst({
              where: { animeId, personId: dbPerson.id, role: s.role },
            });
            if (!existingStaff) {
              await prisma.animeStaff.create({
                data: { animeId, personId: dbPerson.id, role: s.role },
              }).catch(() => {});
            }
          }
          console.log(`     + Synced ${Math.min(staffList.length, 5)} staff members`);
        } catch (e) {
          console.warn(`     ! Could not sync staff for ${item.title}`);
        }
      }
    }
  }

  const finalTotal = await prisma.anime.count();
  console.log(`\n========================================================================`);
  console.log(`  SYNC COMPLETE: ${syncedCount} anime titles synced with characters & staff.`);
  console.log(`  Total Active Database Anime: ${finalTotal}`);
  console.log(`========================================================================\n`);
}

main()
  .catch((err) => {
    console.error('Fatal sync error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
