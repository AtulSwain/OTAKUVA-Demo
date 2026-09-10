import { prisma } from '../src/lib/prisma';

async function repair() {
  console.log('=== STARTING OTAKUVA CANONICAL DATA REPAIR ===');

  // 1. Purge orphaned test fixtures
  console.log('\n[1/4] Purging orphaned test fixtures...');
  const testAnimes = await prisma.anime.findMany({
    where: { slug: { startsWith: 'phase3-canonical-anime' } },
  });

  console.log(`Found ${testAnimes.length} test anime records to purge.`);
  for (const t of testAnimes) {
    console.log(`  Deleting test anime: ${t.id} (${t.slug})`);
    await prisma.episode.deleteMany({ where: { animeId: t.id } });
    await prisma.season.deleteMany({ where: { animeId: t.id } });
    await prisma.animeTitle.deleteMany({ where: { animeId: t.id } });
    await prisma.animeGenre.deleteMany({ where: { animeId: t.id } });
    await prisma.animeTheme.deleteMany({ where: { animeId: t.id } });
    await prisma.anime.delete({ where: { id: t.id } });
  }

  // 2. Repair canonical anime records
  console.log('\n[2/4] Repairing canonical anime records...');
  
  // Attack on Titan (MAL 16498)
  const aot = await prisma.anime.findFirst({
    where: { OR: [{ slug: 'attack-on-titan' }, { malId: 16498 }] },
  });
  if (aot) {
    await prisma.anime.update({
      where: { id: aot.id },
      data: {
        posterUrl: 'https://cdn.myanimelist.net/images/anime/10/47347.jpg',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/10/47347.jpg',
        scoredBy: 2750000,
        score: 9.17,
      },
    });
    console.log(`  Updated Attack on Titan (ID: ${aot.id}) with canonical MAL artwork & scoredBy`);
  }

  // Fullmetal Alchemist: Brotherhood (MAL 5114)
  const fma = await prisma.anime.findFirst({
    where: { OR: [{ slug: 'fullmetal-alchemist-brotherhood' }, { malId: 5114 }] },
  });
  if (fma) {
    await prisma.anime.update({
      where: { id: fma.id },
      data: {
        posterUrl: 'https://cdn.myanimelist.net/images/anime/1223/96541.jpg',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1223/96541.jpg',
        scoredBy: 2100000,
        score: 9.10,
      },
    });
    console.log(`  Updated Fullmetal Alchemist: Brotherhood (ID: ${fma.id}) with canonical MAL artwork & scoredBy`);
  }

  // Frieren: Beyond Journey's End (MAL 52991)
  const frieren = await prisma.anime.findFirst({
    where: { OR: [{ slug: 'frieren-beyond-journeys-end' }, { malId: 52991 }] },
  });
  if (frieren) {
    await prisma.anime.update({
      where: { id: frieren.id },
      data: {
        posterUrl: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
        bannerUrl: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
        scoredBy: 450000,
        score: 9.41,
      },
    });
    console.log(`  Updated Frieren (ID: ${frieren.id}) with canonical scoredBy`);
  }

  // Demon Slayer (MAL 38000)
  const demonSlayer = await prisma.anime.findFirst({
    where: { OR: [{ slug: 'demon-slayer-kimetsu-no-yaiba' }, { malId: 38000 }] },
  });
  if (demonSlayer) {
    await prisma.anime.update({
      where: { id: demonSlayer.id },
      data: {
        scoredBy: 2200000,
        score: 8.53,
      },
    });
    console.log(`  Updated Demon Slayer (ID: ${demonSlayer.id}) with canonical scoredBy`);
  }

  // 3. Populate Canonical MediaAsset table
  console.log('\n[3/4] Populating canonical MediaAsset records...');
  const allAnime = await prisma.anime.findMany();
  let createdAssets = 0;

  for (const anime of allAnime) {
    if (anime.posterUrl) {
      const existingPoster = await prisma.mediaAsset.findFirst({
        where: { animeId: anime.id, type: 'POSTER' },
      });

      if (!existingPoster) {
        await prisma.mediaAsset.create({
          data: {
            animeId: anime.id,
            type: 'POSTER',
            source: anime.externalSource || 'canonical',
            sourceUrl: anime.posterUrl,
            storedUrl: anime.posterUrl,
            format: 'jpg',
            lastVerifiedAt: new Date(),
          },
        });
        createdAssets++;
      } else {
        await prisma.mediaAsset.update({
          where: { id: existingPoster.id },
          data: {
            sourceUrl: anime.posterUrl,
            storedUrl: anime.posterUrl,
            lastVerifiedAt: new Date(),
          },
        });
      }
    }

    if (anime.bannerUrl) {
      const existingBanner = await prisma.mediaAsset.findFirst({
        where: { animeId: anime.id, type: 'BANNER' },
      });

      if (!existingBanner) {
        await prisma.mediaAsset.create({
          data: {
            animeId: anime.id,
            type: 'BANNER',
            source: anime.externalSource || 'canonical',
            sourceUrl: anime.bannerUrl,
            storedUrl: anime.bannerUrl,
            format: 'jpg',
            lastVerifiedAt: new Date(),
          },
        });
        createdAssets++;
      } else {
        await prisma.mediaAsset.update({
          where: { id: existingBanner.id },
          data: {
            sourceUrl: anime.bannerUrl,
            storedUrl: anime.bannerUrl,
            lastVerifiedAt: new Date(),
          },
        });
      }
    }
  }
  console.log(`  Processed MediaAssets for ${allAnime.length} anime (${createdAssets} new assets created).`);

  // 4. Verification Check
  console.log('\n[4/4] Verifying repaired database state...');
  const finalAnimeList = await prisma.anime.findMany({
    orderBy: [{ score: 'desc' }, { scoredBy: 'desc' }],
    select: {
      id: true,
      canonicalTitle: true,
      slug: true,
      score: true,
      scoredBy: true,
      posterUrl: true,
    },
  });

  console.log(`Total canonical anime remaining: ${finalAnimeList.length}`);
  finalAnimeList.forEach((a, idx) => {
    console.log(`  [#${idx + 1}] "${a.canonicalTitle}" | Score: ${a.score} | ScoredBy: ${a.scoredBy} | Poster: ${a.posterUrl}`);
  });

  console.log('\n=== OTAKUVA CANONICAL DATA REPAIR COMPLETED SUCCESSFULLY ===');
}

repair()
  .catch(console.error)
  .finally(() => process.exit(0));
