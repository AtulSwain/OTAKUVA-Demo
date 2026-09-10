/**
 * OTAKUVA NEWS DEDUPLICATION SERVICE (PHASE 8.4)
 * 
 * Multi-Signal Deduplication & Cross-Provider Syndication Clustering:
 * - Signal 1: Provider + External ID (EXACT)
 * - Signal 2: Canonical URL (EXACT)
 * - Signal 3: Source URL (EXACT)
 * - Signal 4: Cross-provider title similarity + timestamp proximity (SYNDICATION CLUSTER)
 */

import { prisma } from '../../prisma';
import { generateSlug } from '../../normalizers';
import { DuplicateSignal, NormalizedNewsArticle } from './newsTypes';

export interface DuplicateCheckResult {
  signal: DuplicateSignal;
  existingArticleId?: string;
  clusterId?: string;
  isSameProvider: boolean;
  action: 'UPDATE' | 'CLUSTER' | 'CREATE';
}

export class NewsDeduplicationService {
  /**
   * Evaluates an incoming normalized article against existing database records
   */
  async checkDuplicate(article: NormalizedNewsArticle): Promise<DuplicateCheckResult> {
    // 1. Exact Match on Provider + External ID
    const exactByProviderAndId = await prisma.newsArticle.findFirst({
      where: {
        provider: article.provider,
        externalId: article.externalId,
      },
    });

    if (exactByProviderAndId) {
      return {
        signal: 'EXACT',
        existingArticleId: exactByProviderAndId.id,
        clusterId: exactByProviderAndId.clusterId || undefined,
        isSameProvider: true,
        action: 'UPDATE',
      };
    }

    // 2. Exact Match on Canonical URL or Source URL (Same Provider)
    const exactByUrl = await prisma.newsArticle.findFirst({
      where: {
        provider: article.provider,
        OR: [
          { canonicalUrl: article.canonicalUrl },
          { sourceUrl: article.sourceUrl },
        ],
      },
    });

    if (exactByUrl) {
      return {
        signal: 'EXACT',
        existingArticleId: exactByUrl.id,
        clusterId: exactByUrl.clusterId || undefined,
        isSameProvider: true,
        action: 'UPDATE',
      };
    }

    // 3. Cross-Provider Match on Canonical URL
    const crossProviderByUrl = await prisma.newsArticle.findFirst({
      where: {
        provider: { not: article.provider },
        canonicalUrl: article.canonicalUrl,
      },
    });

    if (crossProviderByUrl) {
      const clusterId = await this.ensureStoryCluster(crossProviderByUrl.id, article);
      return {
        signal: 'HIGH_CONFIDENCE',
        clusterId,
        isSameProvider: false,
        action: 'CLUSTER',
      };
    }

    // 4. Cross-Provider Title Similarity & Timestamp Proximity (within 48h)
    const timeMin = new Date(article.publishedAt.getTime() - 48 * 3600000);
    const timeMax = new Date(article.publishedAt.getTime() + 48 * 3600000);

    const candidateStories = await prisma.newsArticle.findMany({
      where: {
        provider: { not: article.provider },
        publishedAt: { gte: timeMin, lte: timeMax },
      },
      select: { id: true, title: true, clusterId: true },
      orderBy: { publishedAt: 'desc' },
      take: 100,
    });

    for (const candidate of candidateStories) {
      const similarity = this.calculateTitleSimilarity(article.normalizedTitle, candidate.title);
      if (similarity >= 0.40) {
        const clusterId = await this.ensureStoryCluster(candidate.id, article);
        return {
          signal: 'HIGH_CONFIDENCE',
          clusterId,
          isSameProvider: false,
          action: 'CLUSTER',
        };
      }
    }

    // New distinct story
    return {
      signal: 'UNRELATED',
      isSameProvider: false,
      action: 'CREATE',
    };
  }

  /**
   * Links or creates a NewsStoryCluster for multi-provider syndicated reports
   */
  private async ensureStoryCluster(existingArticleId: string, incoming: NormalizedNewsArticle): Promise<string> {
    const existing = await prisma.newsArticle.findUnique({
      where: { id: existingArticleId },
      select: { id: true, clusterId: true, title: true, summary: true },
    });

    if (!existing) return '';

    if (existing.clusterId) {
      return existing.clusterId;
    }

    // Create a new cluster
    const cluster = await prisma.newsStoryCluster.create({
      data: {
        topicTitle: incoming.title,
        slug: `cluster-${generateSlug(incoming.title)}-${Date.now().toString().slice(-4)}`,
        summary: incoming.summary || existing.summary,
      },
    });

    // Link the existing article
    await prisma.newsArticle.update({
      where: { id: existing.id },
      data: { clusterId: cluster.id },
    });

    return cluster.id;
  }

  /**
   * Token-based similarity between two title strings
   */
  private calculateTitleSimilarity(titleA: string, titleB: string): number {
    const tokensA = new Set(
      titleA
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );
    const tokensB = new Set(
      titleB
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let intersectionCount = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) {
        intersectionCount++;
      }
    }

    if (intersectionCount >= 3) {
      return 0.85;
    }

    const unionCount = new Set([...tokensA, ...tokensB]).size;
    return unionCount > 0 ? intersectionCount / unionCount : 0;
  }
}

export const newsDeduplicationService = new NewsDeduplicationService();
