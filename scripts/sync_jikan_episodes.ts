import { prisma } from '../src/lib/prisma';
import { jikanProvider } from '../src/lib/providers/jikanProvider';

async function main() {
  const animeRows = await prisma.anime.findMany({
    where: { malId: { not: null } },
    select: { id: true, canonicalTitle: true, malId: true },
    orderBy: { canonicalTitle: 'asc' },
  });

  let imported = 0;
  let pages = 0;

  for (const anime of animeRows) {
    if (!anime.malId) continue;
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const result = await jikanProvider.getAnimeEpisodes(String(anime.malId), page);
      pages++;

      for (const episode of result.episodes) {
        if (!Number.isFinite(episode.number) || episode.number < 0) continue;

        await prisma.episode.upsert({
          where: { animeId_number: { animeId: anime.id, number: episode.number } },
          update: {
            externalId: episode.externalId || undefined,
            title: episode.title || undefined,
            titleJapanese: episode.titleJapanese || undefined,
            synopsis: episode.synopsis || undefined,
            airedAt: episode.airedAt ? new Date(episode.airedAt) : undefined,
            duration: episode.duration || undefined,
            filler: episode.filler,
            recap: episode.recap,
            externalUrl: episode.externalUrl || undefined,
          },
          create: {
            animeId: anime.id,
            externalId: episode.externalId || null,
            number: episode.number,
            title: episode.title || null,
            titleJapanese: episode.titleJapanese || null,
            synopsis: episode.synopsis || null,
            airedAt: episode.airedAt ? new Date(episode.airedAt) : null,
            duration: episode.duration || null,
            filler: episode.filler,
            recap: episode.recap,
            externalUrl: episode.externalUrl || null,
          },
        });
        imported++;
      }

      hasNextPage = result.pagination.hasNextPage;
      page++;
    }

    console.log(`Synced episodes: ${anime.canonicalTitle}`);
  }

  console.log(`Episode sync complete: ${imported} upserts across ${pages} provider pages.`);
}

main()
  .catch((error) => {
    console.error('Episode sync failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });