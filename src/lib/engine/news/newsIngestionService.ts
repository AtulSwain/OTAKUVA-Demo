/**
 * OTAKUVA NEWS INGESTION SERVICE (PHASES 8.2 → 8.5)
 * 
 * 9-Stage Ingestion Pipeline:
 * 1. FETCH from Provider Adapter (with timeout, retries, and rate throttling)
 * 2. VALIDATE raw payload integrity
 * 3. NORMALIZE title, categories, dates, URLs, and sanitize HTML
 * 4. IDENTIFY provider identity & validate external IDs
 * 5. DEDUPLICATE (provider+id exact check & multi-provider syndication clustering)
 * 6. ENTITY MATCH (Layered resolution for Anime, Studios, People, Seasons, Episodes)
 * 7. PERSIST (Atomic transaction storing article, relationships, & review queue items)
 * 8. EMIT EVENT (Standardized OTAKUVA EventLog stream)
 * 9. UPDATE SYNC STATE & JOB METRICS
 */

import { prisma } from '../../prisma';
import { emitEngineEvent } from '../events/eventEngine';
import { newsDeduplicationService } from './newsDeduplicationService';
import { newsEntityMatcher } from './newsEntityMatcher';
import { newsNormalizationService } from './newsNormalizationService';
import { NewsProviderAdapter } from './newsProvider.interface';
import {
  IngestionJobStatus,
  IngestionResult,
  NormalizedNewsArticle,
  RawNewsArticle,
} from './newsTypes';

export class NewsIngestionService {
  /**
   * Runs the full ingestion pipeline for a given provider adapter
   */
  async ingestFromProvider(
    adapter: NewsProviderAdapter,
    options: {
      limit?: number;
      sinceDate?: Date;
    } = {}
  ): Promise<IngestionResult> {
    const startTime = Date.now();
    const { limit = 50, sinceDate } = options;

    // 1. Create Ingestion Job Record
    const job = await prisma.newsIngestionJob.create({
      data: {
        providerSlug: adapter.id,
        status: 'RUNNING',
      },
    });

    const result: IngestionResult = {
      jobId: job.id,
      provider: adapter.id,
      totalFetched: 0,
      createdCount: 0,
      updatedCount: 0,
      duplicatesDetected: 0,
      entityMatchesCreated: 0,
      reviewRequiredCount: 0,
      failedCount: 0,
      errors: [],
      durationMs: 0,
      status: 'RUNNING',
    };

    let rawArticles: RawNewsArticle[] = [];

    // Stage 1: FETCH
    try {
      if (sinceDate) {
        rawArticles = await adapter.fetchByDate(sinceDate);
      } else {
        rawArticles = await adapter.fetchLatest(limit);
      }
      result.totalFetched = rawArticles.length;
    } catch (fetchError: any) {
      console.error(`[NewsIngestion] Fetch failed for ${adapter.id}:`, fetchError);
      result.failedCount = 1;
      result.errors.push(`Fetch failed: ${fetchError.message}`);
      result.status = 'FAILED';
      result.durationMs = Date.now() - startTime;

      await this.recordProviderFailure(adapter.id, fetchError.message);
      await this.finalizeJob(job.id, result);

      await emitEngineEvent({
        eventType: 'NEWS_INGESTION_FAILED',
        entityType: 'NEWS_PROVIDER',
        entityId: adapter.id,
        metadata: { provider: adapter.id, error: fetchError.message },
      });

      return result;
    }

    // Process articles sequentially with partial-failure isolation
    for (const raw of rawArticles) {
      try {
        await this.processSingleArticle(raw, adapter.id, result);
      } catch (itemError: any) {
        result.failedCount++;
        result.errors.push(`Failed article [${raw.externalId || 'UNKNOWN'}]: ${itemError.message}`);
      }
    }

    // Update Provider Success State
    await this.recordProviderSuccess(adapter.id);

    result.status = result.failedCount > 0 && result.createdCount + result.updatedCount > 0
      ? 'PARTIAL'
      : result.failedCount > 0 && result.createdCount + result.updatedCount === 0
      ? 'FAILED'
      : 'COMPLETED';

    result.durationMs = Date.now() - startTime;

    // Finalize Job Record
    await this.finalizeJob(job.id, result);

    return result;
  }

  /**
   * Processes a single article through stages 2 through 8
   */
  private async processSingleArticle(
    raw: RawNewsArticle,
    providerSlug: string,
    result: IngestionResult
  ): Promise<void> {
    // Stage 2: VALIDATE
    this.validateRawArticle(raw);

    // Stage 3: NORMALIZE
    const normalized = newsNormalizationService.normalize(raw, providerSlug);

    // Stage 4: DEDUPLICATE & CLUSTER CHECK
    const dedupe = await newsDeduplicationService.checkDuplicate(normalized);

    if (dedupe.action === 'UPDATE' && dedupe.existingArticleId) {
      result.duplicatesDetected++;
      await this.updateExistingArticle(dedupe.existingArticleId, normalized, raw, result);
    } else {
      // Stage 5 & 6: ENTITY MATCH & PERSIST NEW
      if (dedupe.clusterId) {
        normalized.slug = `${normalized.slug}-${Date.now().toString().slice(-4)}`;
      }
      await this.persistNewArticle(normalized, raw, dedupe.clusterId, result);
    }
  }

  /**
   * Persists a brand-new canonical article and matches entities inside an atomic transaction
   */
  private async persistNewArticle(
    normalized: NormalizedNewsArticle,
    raw: RawNewsArticle,
    clusterId: string | undefined,
    result: IngestionResult
  ): Promise<void> {
    // Entity Matching
    const entityMatches = await newsEntityMatcher.matchEntities(raw);

    // Atomic Prisma Transaction
    const createdArticle = await prisma.$transaction(async (tx) => {
      // Ensure unique slug
      let uniqueSlug = normalized.slug;
      const slugCollision = await tx.newsArticle.findUnique({ where: { slug: uniqueSlug } });
      if (slugCollision) {
        uniqueSlug = `${normalized.slug}-${Date.now().toString().slice(-6)}`;
      }

      const article = await tx.newsArticle.create({
        data: {
          title: normalized.title,
          subtitle: normalized.subtitle,
          slug: uniqueSlug,
          summary: normalized.summary,
          content: normalized.content,
          contentType: normalized.contentType,
          sourceName: normalized.sourceName,
          sourceUrl: normalized.sourceUrl,
          canonicalUrl: normalized.canonicalUrl,
          imageUrl: normalized.imageUrl,
          author: normalized.author,
          language: normalized.language,
          category: normalized.category,
          status: 'PUBLISHED',
          publishedAt: normalized.publishedAt,
          discoveredAt: new Date(),
          provider: normalized.provider,
          externalId: normalized.externalId,
          ingestedAt: new Date(),
          lastSyncedAt: new Date(),
          clusterId: clusterId || null,
        },
      });

      // Link Confirmed Anime
      for (const anime of entityMatches.matchedAnime) {
        await tx.newsArticleAnime.create({
          data: {
            articleId: article.id,
            animeId: anime.animeId,
            confidenceScore: anime.confidenceScore,
            matchMethod: anime.matchMethod,
            relationType: anime.relationType,
            status: 'CONFIRMED',
          },
        });
      }

      // Link Confirmed Studios
      for (const studio of entityMatches.matchedStudios) {
        await tx.newsArticleStudio.create({
          data: {
            articleId: article.id,
            studioId: studio.studioId,
            confidenceScore: studio.confidenceScore,
            matchMethod: studio.matchMethod,
            relationType: studio.relationType,
            status: 'CONFIRMED',
          },
        });
      }

      // Link Confirmed People
      for (const person of entityMatches.matchedPeople) {
        await tx.newsArticlePerson.create({
          data: {
            articleId: article.id,
            personId: person.personId,
          },
        });
      }

      // Add ambiguous matches to NewsReviewQueue
      for (const item of entityMatches.reviewQueueItems) {
        await tx.newsReviewQueue.create({
          data: {
            articleId: article.id,
            entityType: item.entityType,
            entityName: item.entityName,
            matchedEntityId: item.matchedEntityId || null,
            confidenceScore: item.confidenceScore,
            status: 'PENDING',
          },
        });
      }

      return article;
    });

    result.createdCount++;
    result.entityMatchesCreated += entityMatches.matchedAnime.length + entityMatches.matchedStudios.length;
    result.reviewRequiredCount += entityMatches.reviewQueueItems.length;

    // Stage 8: EMIT EVENTS
    await emitEngineEvent({
      eventType: 'NEWS_INGESTED',
      entityType: 'NEWS',
      entityId: createdArticle.id,
      metadata: {
        title: createdArticle.title,
        provider: createdArticle.provider,
        externalId: createdArticle.externalId,
      },
    });

    if (entityMatches.reviewQueueItems.length > 0) {
      await emitEngineEvent({
        eventType: 'NEWS_ENTITY_REVIEW_REQUIRED',
        entityType: 'NEWS',
        entityId: createdArticle.id,
        metadata: { queueCount: entityMatches.reviewQueueItems.length },
      });
    }
  }

  /**
   * Updates an existing article idempotently
   */
  private async updateExistingArticle(
    articleId: string,
    normalized: NormalizedNewsArticle,
    raw: RawNewsArticle,
    result: IngestionResult
  ): Promise<void> {
    const entityMatches = await newsEntityMatcher.matchEntities(raw, articleId);

    await prisma.$transaction(async (tx) => {
      await tx.newsArticle.update({
        where: { id: articleId },
        data: {
          title: normalized.title,
          subtitle: normalized.subtitle,
          summary: normalized.summary,
          canonicalUrl: normalized.canonicalUrl,
          imageUrl: normalized.imageUrl || undefined,
          lastSyncedAt: new Date(),
        },
      });

      // Update new confirmed anime relations if not already present
      for (const anime of entityMatches.matchedAnime) {
        const exists = await tx.newsArticleAnime.findUnique({
          where: { articleId_animeId: { articleId, animeId: anime.animeId } },
        });
        if (!exists) {
          await tx.newsArticleAnime.create({
            data: {
              articleId,
              animeId: anime.animeId,
              confidenceScore: anime.confidenceScore,
              matchMethod: anime.matchMethod,
              relationType: anime.relationType,
              status: 'CONFIRMED',
            },
          });
          result.entityMatchesCreated++;
        }
      }
    });

    result.updatedCount++;

    await emitEngineEvent({
      eventType: 'NEWS_UPDATED',
      entityType: 'NEWS',
      entityId: articleId,
      metadata: { title: normalized.title },
    });
  }

  /**
   * Validates mandatory fields on a raw article
   */
  private validateRawArticle(raw: RawNewsArticle): void {
    if (!raw.externalId || typeof raw.externalId !== 'string' || !raw.externalId.trim()) {
      throw new Error('Missing mandatory externalId');
    }
    if (!raw.title || typeof raw.title !== 'string' || !raw.title.trim()) {
      throw new Error('Missing mandatory title');
    }
    if (!raw.sourceUrl || typeof raw.sourceUrl !== 'string' || !raw.sourceUrl.trim()) {
      throw new Error('Missing mandatory sourceUrl');
    }
    if (!raw.publishedAt || isNaN(new Date(raw.publishedAt).getTime())) {
      throw new Error('Missing or invalid publishedAt date');
    }
  }

  private async recordProviderSuccess(providerSlug: string): Promise<void> {
    await prisma.newsProvider.upsert({
      where: { slug: providerSlug },
      update: {
        status: 'HEALTHY',
        lastSuccessfulSync: new Date(),
        failureCount: 0,
      },
      create: {
        name: providerSlug.toUpperCase(),
        slug: providerSlug,
        baseUrl: 'https://www.animenewsnetwork.com',
        status: 'HEALTHY',
        lastSuccessfulSync: new Date(),
        failureCount: 0,
      },
    });
  }

  private async recordProviderFailure(providerSlug: string, errorMsg: string): Promise<void> {
    const existing = await prisma.newsProvider.findUnique({ where: { slug: providerSlug } });
    const currentFailures = (existing?.failureCount || 0) + 1;
    const status = currentFailures >= 3 ? 'FAILED' : 'DEGRADED';

    await prisma.newsProvider.upsert({
      where: { slug: providerSlug },
      update: {
        status,
        lastFailedSync: new Date(),
        failureCount: currentFailures,
      },
      create: {
        name: providerSlug.toUpperCase(),
        slug: providerSlug,
        baseUrl: 'https://www.animenewsnetwork.com',
        status,
        lastFailedSync: new Date(),
        failureCount: 1,
      },
    });
  }

  private async finalizeJob(jobId: string, result: IngestionResult): Promise<void> {
    await prisma.newsIngestionJob.update({
      where: { id: jobId },
      data: {
        status: result.status,
        articlesFetched: result.totalFetched,
        articlesCreated: result.createdCount,
        articlesUpdated: result.updatedCount,
        duplicatesCount: result.duplicatesDetected,
        matchesCreated: result.entityMatchesCreated,
        reviewRequired: result.reviewRequiredCount,
        failedCount: result.failedCount,
        errorSummary: result.errors.length > 0 ? result.errors.slice(0, 5).join(' | ') : null,
        completedAt: new Date(),
      },
    });
  }
}

export const newsIngestionService = new NewsIngestionService();
