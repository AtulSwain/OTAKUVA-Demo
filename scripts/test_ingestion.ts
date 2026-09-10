import { prisma } from '../src/lib/prisma';
import { sourceRegistryService } from '../src/lib/engine/news/sourceRegistryService';
import { annNewsAdapter } from '../src/lib/engine/news/adapters/annNewsAdapter';
import { crunchyrollNewsAdapter } from '../src/lib/engine/news/adapters/crunchyrollNewsAdapter';
import { newsIngestionService } from '../src/lib/engine/news/newsIngestionService';

async function main() {
  console.log('--- 1. Ensuring Canonical Sources in Registry ---');
  await sourceRegistryService.ensureCanonicalSources();
  const sources = await prisma.newsProvider.findMany();
  console.log('Registered sources:', sources.map(s => `${s.name} (${s.slug}, trust: ${s.trustLevel})`));

  console.log('\n--- 2. Ingesting from Crunchyroll News ---');
  const crResult = await newsIngestionService.ingestFromProvider(crunchyrollNewsAdapter, { limit: 10 });
  console.log('Crunchyroll result:', {
    fetched: crResult.totalFetched,
    created: crResult.createdCount,
    updated: crResult.updatedCount,
    duplicates: crResult.duplicatesDetected,
    entities: crResult.entityMatchesCreated,
    status: crResult.status,
  });

  console.log('\n--- 3. Ingesting from Anime News Network ---');
  const annResult = await newsIngestionService.ingestFromProvider(annNewsAdapter, { limit: 10 });
  console.log('ANN result:', {
    fetched: annResult.totalFetched,
    created: annResult.createdCount,
    updated: annResult.updatedCount,
    duplicates: annResult.duplicatesDetected,
    entities: annResult.entityMatchesCreated,
    status: annResult.status,
  });

  console.log('\n--- 4. Checking Ingested News in DB ---');
  const total = await prisma.newsArticle.count();
  console.log(`Total NewsArticle in DB: ${total}`);

  const sample = await prisma.newsArticle.findMany({
    take: 5,
    orderBy: { publishedAt: 'desc' },
    include: {
      animeRelations: { include: { anime: { select: { canonicalTitle: true } } } },
      studioRelations: { include: { studio: { select: { name: true } } } },
    },
  });

  for (const a of sample) {
    console.log({
      id: a.id,
      title: a.title,
      source: a.sourceName,
      author: a.author,
      category: a.category,
      publishedAt: a.publishedAt.toISOString(),
      hasImage: !!a.imageUrl,
      imageUrl: a.imageUrl ? a.imageUrl.slice(0, 80) + '...' : null,
      canonicalUrl: a.canonicalUrl,
      linkedAnime: a.animeRelations.map(r => r.anime.canonicalTitle),
      linkedStudios: a.studioRelations.map(r => r.studio.name),
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
