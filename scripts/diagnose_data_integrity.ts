import { prisma } from '../src/lib/prisma';

async function diagnose() {
  console.log('=== FULL RELATIONSHIP & DATA INTEGRITY AUDIT ===');
  const animes = await prisma.anime.findMany({
    include: {
      _count: {
        select: {
          seasons: true,
          episodesList: true,
          userAnimes: true,
          userEpisodeProgress: true,
          ratings: true,
          reviews: true,
          discussions: true,
          airingSchedules: true,
          animeStudios: true,
          characters: true,
        },
      },
      externalIds: true,
    },
    orderBy: [{ score: 'desc' }, { scoredBy: 'desc' }],
  });

  console.log(`Total Anime in DB: ${animes.length}\n`);
  for (const a of animes) {
    console.log(`Anime: "${a.canonicalTitle}" (ID: ${a.id}, Slug: ${a.slug})`);
    console.log(`  MAL ID: ${a.malId}, AniList ID: ${a.anilistId}, ExternalIds: ${JSON.stringify(a.externalIds)}`);
    console.log(`  Score: ${a.score}, ScoredBy: ${a.scoredBy}, Status: ${a.status}`);
    console.log(`  Poster: ${a.posterUrl}`);
    console.log(`  Banner: ${a.bannerUrl}`);
    console.log(`  Counts:`, a._count);
    console.log('----------------------------------------------------');
  }
}

diagnose()
  .catch(console.error)
  .finally(() => process.exit(0));
