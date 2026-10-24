import { prisma } from './prisma';
import { normalizeJikanAnime } from './jikan';
import { getJikanTopAnime } from './jikanService';

export async function syncAnimeCatalog() {
  console.log('Starting full relational anime catalog synchronization...');

  // This used to run seedDatabase() first, which upserted the fixture user
  // "user_default", fixture anime, reviews, discussions and watch progress
  // into whatever database the sync ran against — production included.
  // Seeding is a dev-only step (`prisma db seed`), never part of a sync.

  // 2. Fetch Top Anime from Jikan (via jikanService, which owns
  // pacing/retry/caching — see the note in jikan.ts)
  const { animes: topAnimeRaw } = await getJikanTopAnime(1, 25);
  const topAnimeList = topAnimeRaw.map(normalizeJikanAnime);
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

      // Episodes are not created here. They come from the provider's episode
      // listing (SyncEngine.syncEpisodes); this used to insert placeholder
      // "Episode 1..N" rows (N defaulting to 12) that looked like real data.
    } catch (e) {
      console.warn(`Sync error on top anime ${item.title}:`, e);
    }
  }

  const finalCount = await prisma.anime.count();
  console.log(`Relational synchronization complete. Total anime: ${finalCount}`);
  return { finalCount };
}
