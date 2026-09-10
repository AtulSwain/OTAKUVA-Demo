/**
 * OTAKUVA ANIME CATALOG & DATA INGESTION ENGINE — PHASE 13
 * SEARCH INDEX SYNCHRONIZATION ENGINE (13.49 → 13.51)
 * 
 * Synchronizes canonical catalog records with the search index:
 * - Incremental sync on anime mutations
 * - Searchable title tokenization
 * - Controlled bulk re-indexing with batching
 */

import { prisma } from '../prisma';
import { CatalogNormalizer } from './normalizer';
import { CacheManager } from '../performance/cacheManager';

export class SearchSyncEngine {
  /**
   * Synchronizes search index for a single anime
   */
  static async syncAnimeSearchIndex(animeId: string): Promise<boolean> {
    const anime = await prisma.anime.findUnique({
      where: { id: animeId },
      include: { titles: true },
    });

    if (!anime) return false;

    // 1. Ensure canonical title is indexed
    const canonicalKey = CatalogNormalizer.generateSearchKey(anime.canonicalTitle);
    const existingCanonical = anime.titles.find((t) => t.type === 'official');

    if (!existingCanonical) {
      await prisma.animeTitle.create({
        data: {
          animeId,
          type: 'official',
          title: anime.canonicalTitle,
          isPrimary: true,
          searchableTitle: canonicalKey,
        },
      });
    } else if (existingCanonical.searchableTitle !== canonicalKey) {
      await prisma.animeTitle.update({
        where: { id: existingCanonical.id },
        data: { searchableTitle: canonicalKey },
      });
    }

    // 2. Invalidate search cache
    CacheManager.invalidateTag(`tag:anime:${animeId}`);
    CacheManager.invalidateTag('tag:search:catalog');

    return true;
  }

  /**
   * Executes a controlled bulk reindex of the catalog
   */
  static async executeFullReindex(batchSize = 100): Promise<{
    processedCount: number;
    updatedTitlesCount: number;
    durationMs: number;
  }> {
    const startTime = Date.now();
    let processedCount = 0;
    let updatedTitlesCount = 0;
    let skip = 0;

    while (true) {
      const batch = await prisma.anime.findMany({
        skip,
        take: batchSize,
        include: { titles: true },
      });

      if (batch.length === 0) break;

      for (const a of batch) {
        const canonicalKey = CatalogNormalizer.generateSearchKey(a.canonicalTitle);
        const officialTitle = a.titles.find((t) => t.type === 'official');

        if (!officialTitle) {
          await prisma.animeTitle.create({
            data: {
              animeId: a.id,
              type: 'official',
              title: a.canonicalTitle,
              isPrimary: true,
              searchableTitle: canonicalKey,
            },
          });
          updatedTitlesCount++;
        }

        processedCount++;
      }

      skip += batch.length;
    }

    CacheManager.clearAll();

    return {
      processedCount,
      updatedTitlesCount,
      durationMs: Date.now() - startTime,
    };
  }
}
