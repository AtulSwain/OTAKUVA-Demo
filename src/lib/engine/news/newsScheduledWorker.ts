/**
 * OTAKUVA SCHEDULED NEWS PUBLICATION WORKER (PHASE 8.11 / 8.12)
 * 
 * Production Scheduled Publishing Engine:
 * - Automatically scans for articles due for publication
 * - Performs pre-publication quality validation
 * - Transitions valid articles to PUBLISHED state with audit logging
 * - Flags invalid articles as PUBLISH_BLOCKED without silent loss
 * - Emits NEWS_PUBLISHED events & invalidates caches
 */

import { prisma } from '../../prisma';
import { emitEngineEvent } from '../events/eventEngine';
import { newsOperationsService } from './newsOperationsService';
import { newsTrendingService } from './newsTrendingService';

export class NewsScheduledWorker {
  /**
   * Scans and processes all scheduled articles whose publish time has arrived
   */
  async processScheduledArticles(): Promise<{
    publishedCount: number;
    blockedCount: number;
    processedIds: string[];
  }> {
    const now = new Date();

    const dueArticles = await prisma.newsArticle.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledPublishAt: { lte: now },
        deletedAt: null,
      },
    });

    if (dueArticles.length === 0) {
      return { publishedCount: 0, blockedCount: 0, processedIds: [] };
    }

    let publishedCount = 0;
    let blockedCount = 0;
    const processedIds: string[] = [];

    for (const article of dueArticles) {
      processedIds.push(article.id);

      // Automated pre-publication quality check
      const quality = await newsOperationsService.checkArticleQuality(article.id);

      if (quality.status === 'BLOCKED') {
        // Block publication due to critical quality failure
        await prisma.newsArticle.update({
          where: { id: article.id },
          data: {
            status: 'PUBLISH_BLOCKED',
            moderationState: 'PUBLISH_BLOCKED',
          },
        });

        await prisma.auditLog.create({
          data: {
            actorId: null,
            action: 'NEWS_SCHEDULED_PUBLISH_BLOCKED',
            entityType: 'NEWS_ARTICLE',
            entityId: article.id,
            afterJson: JSON.stringify({ issues: quality.issues }),
          },
        });

        blockedCount++;
      } else {
        // Successfully publish scheduled article
        await prisma.newsArticle.update({
          where: { id: article.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: now,
            moderationState: 'APPROVED',
          },
        });

        await prisma.auditLog.create({
          data: {
            actorId: null,
            action: 'NEWS_SCHEDULED_PUBLISHED',
            entityType: 'NEWS_ARTICLE',
            entityId: article.id,
            afterJson: JSON.stringify({ publishedAt: now }),
          },
        });

        await emitEngineEvent({
          eventType: 'NEWS_PUBLISHED',
          userId: undefined,
          entityType: 'NEWS',
          entityId: article.id,
          metadata: { title: article.title, scheduled: true },
        });

        publishedCount++;
      }
    }

    if (publishedCount > 0) {
      newsTrendingService.invalidateCache();
    }

    return { publishedCount, blockedCount, processedIds };
  }
}

export const newsScheduledWorker = new NewsScheduledWorker();
