import { prisma } from './prisma';
import { fetchTopAnimeFromJikan, fetchSeasonalAnimeFromJikan } from './jikan';
import { seedDatabase } from './seed';

export async function syncAnimeCatalog() {
  console.log('Starting full relational anime catalog synchronization...');

  // 1. Ensure baseline seeds exist
  await seedDatabase();

  // 2. Fetch Top Anime from Jikan
  const topAnimeList = await fetchTopAnimeFromJikan(1, 25);
  for (const item of topAnimeList) {
    try {
      const savedAnime = await prisma.anime.upsert({
        where: { slug: item.id },
        update: {
          canonicalTitle: item.title,
          synopsis: item.synopsis,
          type: item.type,
          episodes: item.episodes,
          status: item.status,
          season: item.season,
          year: item.year,
          score: item.score,
          scoredBy: item.ratingCount || 0,
          rank: item.rank,
          popularity: item.popularity,
          posterUrl: item.posterImage,
          largePosterUrl: item.posterImage,
          bannerUrl: item.bannerImage || item.posterImage,
          duration: item.duration,
          source: item.source,
          lastSyncedAt: new Date(),
        },
        create: {
          id: item.id,
          externalId: item.externalId,
          externalSource: item.externalSource,
          slug: item.id,
          canonicalTitle: item.title,
          synopsis: item.synopsis,
          type: item.type,
          episodes: item.episodes,
          status: item.status,
          season: item.season,
          year: item.year,
          score: item.score,
          scoredBy: item.ratingCount || 0,
          rank: item.rank,
          popularity: item.popularity,
          posterUrl: item.posterImage,
          largePosterUrl: item.posterImage,
          bannerUrl: item.bannerImage || item.posterImage,
          duration: item.duration,
          source: item.source,
        },
      });

      // Insert Titles
      if (item.englishTitle && item.englishTitle !== item.title) {
        await prisma.animeTitle.create({
          data: { animeId: savedAnime.id, type: 'english', title: item.englishTitle },
        });
      }
      if (item.japaneseTitle) {
        await prisma.animeTitle.create({
          data: { animeId: savedAnime.id, type: 'japanese', title: item.japaneseTitle },
        });
      }

      // Insert Genres
      for (const g of item.genres) {
        const genre = await prisma.genre.upsert({
          where: { name: g },
          update: {},
          create: { name: g, slug: g.toLowerCase().replace(/\s+/g, '-') },
        });
        await prisma.animeGenre.upsert({
          where: { animeId_genreId: { animeId: savedAnime.id, genreId: genre.id } },
          update: {},
          create: { animeId: savedAnime.id, genreId: genre.id },
        });
      }

      // Insert Studios
      for (const s of item.studios) {
        const studio = await prisma.studio.upsert({
          where: { name: s },
          update: {},
          create: { name: s },
        });
        await prisma.animeStudio.upsert({
          where: { animeId_studioId: { animeId: savedAnime.id, studioId: studio.id } },
          update: {},
          create: { animeId: savedAnime.id, studioId: studio.id, isMain: true },
        });
      }

      // Insert Episodes
      const totalEps = item.episodes || 12;
      for (let i = 1; i <= Math.min(totalEps, 24); i++) {
        await prisma.episode.upsert({
          where: { animeId_number: { animeId: savedAnime.id, number: i } },
          update: {},
          create: {
            animeId: savedAnime.id,
            number: i,
            title: `Episode ${i}`,
            duration: item.duration || '24 min',
          },
        });
      }
    } catch (e) {
      console.warn(`Sync error on top anime ${item.title}:`, e);
    }
  }

  const finalCount = await prisma.anime.count();
  console.log(`Relational synchronization complete. Total anime: ${finalCount}`);
  return { finalCount };
}
