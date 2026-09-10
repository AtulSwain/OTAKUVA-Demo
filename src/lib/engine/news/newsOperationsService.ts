/**
 * OTAKUVA NEWS OPERATIONS & QUALITY CONTROL SERVICE (PHASE 8.12)
 * 
 * Production Operations Center:
 * - Provider & Ingestion Health Telemetry
 * - News Data Quality Score calculation (0 - 100)
 * - Automated article quality checks (PASS, WARNING, BLOCKED)
 * - Comprehensive performance & engagement analytics
 * - Trending explainability metrics
 */

import { prisma } from '../../prisma';
import { NEWS_CATEGORIES } from './newsTypes';

export interface QualityCheckIssue {
  severity: 'WARNING' | 'CRITICAL';
  field: string;
  message: string;
  remediation: string;
}

export interface QualityCheckResult {
  articleId: string;
  status: 'PASS' | 'WARNING' | 'BLOCKED';
  qualityScore: number;
  issues: QualityCheckIssue[];
  details: {
    hasTitle: boolean;
    hasSummary: boolean;
    hasValidUrl: boolean;
    hasImage: boolean;
    hasAnimeRelation: boolean;
    hasStudioRelation: boolean;
    hasValidCategory: boolean;
    isSafeHtml: boolean;
  };
}

export class NewsOperationsService {
  /**
   * Generates operations overview including provider health, job metrics, and quality telemetry
   */
  async getOperationsOverview() {
    const [
      providers,
      recentJobs,
      totalArticles,
      pendingReviews,
      duplicateClusters,
      scheduledCount,
    ] = await Promise.all([
      prisma.newsProvider.findMany({ orderBy: { updatedAt: 'desc' } }),
      prisma.newsIngestionJob.findMany({ orderBy: { startedAt: 'desc' }, take: 10 }),
      prisma.newsArticle.count({ where: { deletedAt: null } }),
      prisma.newsReviewQueue.count({ where: { status: 'PENDING' } }),
      prisma.newsStoryCluster.count(),
      prisma.newsArticle.count({ where: { status: 'SCHEDULED', deletedAt: null } }),
    ]);

    // Calculate Ingestion Totals across all jobs
    let totalFetched = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalDuplicates = 0;
    let totalFailed = 0;

    recentJobs.forEach((job) => {
      totalFetched += job.articlesFetched;
      totalCreated += job.articlesCreated;
      totalUpdated += job.articlesUpdated;
      totalDuplicates += job.duplicatesCount;
      totalFailed += job.failedCount;
    });

    const dataQuality = await this.calculateDataQualityScore();

    return {
      overview: {
        totalArticles,
        pendingReviews,
        duplicateClusters,
        scheduledArticles: scheduledCount,
        dataQualityScore: dataQuality.overallScore,
      },
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        lastFetchAt: p.lastSuccessfulSync || p.lastFailedSync,
        failureCount: p.failureCount,
        lastError: p.lastFailedSync ? 'Sync error reported' : null,
      })),
      ingestionHealth: {
        recentJobsCount: recentJobs.length,
        totalFetched,
        totalCreated,
        totalUpdated,
        totalDuplicates,
        totalFailed,
        duplicateRate: totalFetched > 0 ? Math.round((totalDuplicates / totalFetched) * 100) : 0,
        failureRate: totalFetched > 0 ? Math.round((totalFailed / totalFetched) * 100) : 0,
        recentJobs,
      },
      dataQuality,
    };
  }

  /**
   * Computes composite News Data Quality Score (0 - 100)
   */
  async calculateDataQualityScore() {
    const sampleArticles = await prisma.newsArticle.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      include: { animeRelations: true, studioRelations: true },
      take: 100,
    });

    if (sampleArticles.length === 0) {
      return { overallScore: 100, completenessRate: 100, entityMatchRate: 100, imageCoverageRate: 100 };
    }

    let summaryCount = 0;
    let validUrlCount = 0;
    let imageCount = 0;
    let entityMatchCount = 0;

    sampleArticles.forEach((a) => {
      if (a.summary && a.summary.length > 20) summaryCount++;
      if (a.canonicalUrl && (a.canonicalUrl.startsWith('http://') || a.canonicalUrl.startsWith('https://') || a.canonicalUrl.startsWith('/'))) validUrlCount++;
      if (a.imageUrl) imageCount++;
      if (a.animeRelations.length > 0 || a.studioRelations.length > 0) entityMatchCount++;
    });

    const total = sampleArticles.length;
    const completenessRate = Math.round((summaryCount / total) * 100);
    const validUrlRate = Math.round((validUrlCount / total) * 100);
    const imageCoverageRate = Math.round((imageCount / total) * 100);
    const entityMatchRate = Math.round((entityMatchCount / total) * 100);

    const overallScore = Math.round(
      completenessRate * 0.3 + validUrlRate * 0.25 + entityMatchRate * 0.3 + imageCoverageRate * 0.15
    );

    return {
      overallScore,
      completenessRate,
      validUrlRate,
      imageCoverageRate,
      entityMatchRate,
      sampleSize: total,
    };
  }

  /**
   * Automated quality check for an individual article
   */
  async checkArticleQuality(articleId: string): Promise<QualityCheckResult> {
    const article = await prisma.newsArticle.findUnique({
      where: { id: articleId },
      include: { animeRelations: true, studioRelations: true },
    });

    if (!article) {
      throw new Error(`Article not found: ${articleId}`);
    }

    const issues: QualityCheckIssue[] = [];
    let score = 100;

    const hasTitle = Boolean(article.title && article.title.trim().length > 5);
    if (!hasTitle) {
      score -= 40;
      issues.push({
        severity: 'CRITICAL',
        field: 'title',
        message: 'Article title is missing or under 5 characters.',
        remediation: 'Provide an informative editorial headline.',
      });
    }

    const hasSummary = Boolean(article.summary && article.summary.trim().length > 20);
    if (!hasSummary) {
      score -= 15;
      issues.push({
        severity: 'WARNING',
        field: 'summary',
        message: 'Article summary is missing or brief.',
        remediation: 'Add a 1-2 sentence synopsis of key developments.',
      });
    }

    const hasValidUrl = Boolean(
      article.canonicalUrl &&
        (article.canonicalUrl.startsWith('http://') ||
          article.canonicalUrl.startsWith('https://') ||
          article.canonicalUrl.startsWith('/'))
    );
    if (!hasValidUrl) {
      score -= 35;
      issues.push({
        severity: 'CRITICAL',
        field: 'canonicalUrl',
        message: 'Missing or malformed canonical source URL.',
        remediation: 'Supply a valid HTTP/HTTPS source link for attribution.',
      });
    }

    const hasImage = Boolean(article.imageUrl);
    if (!hasImage) {
      score -= 10;
      issues.push({
        severity: 'WARNING',
        field: 'imageUrl',
        message: 'Missing hero image asset.',
        remediation: 'Add key visual or production poster URL.',
      });
    }

    const hasAnimeRelation = article.animeRelations.length > 0;
    const hasStudioRelation = article.studioRelations.length > 0;
    if (!hasAnimeRelation && !hasStudioRelation) {
      score -= 15;
      issues.push({
        severity: 'WARNING',
        field: 'entityRelations',
        message: 'Article is not connected to any Anime or Studio catalog entity.',
        remediation: 'Link the relevant franchise or animation studio in entity management.',
      });
    }

    const hasValidCategory = NEWS_CATEGORIES.includes(article.category as any);
    const isSafeHtml =
      !article.summary?.includes('<script>') &&
      !article.summary?.includes('<iframe>') &&
      !article.content?.includes('<script>');

    if (!isSafeHtml) {
      score = 0;
      issues.push({
        severity: 'CRITICAL',
        field: 'content',
        message: 'Unsafe HTML or script tags detected in content/summary.',
        remediation: 'Sanitize content markup and remove all active script tags.',
      });
    }

    const status: QualityCheckResult['status'] =
      issues.some((i) => i.severity === 'CRITICAL') ? 'BLOCKED' : issues.length > 0 ? 'WARNING' : 'PASS';

    return {
      articleId,
      status,
      qualityScore: Math.max(0, score),
      issues,
      details: {
        hasTitle,
        hasSummary,
        hasValidUrl,
        hasImage,
        hasAnimeRelation,
        hasStudioRelation,
        hasValidCategory,
        isSafeHtml,
      },
    };
  }

  /**
   * Compiles comprehensive news performance analytics
   */
  async getNewsAnalytics(timeframe: '24h' | '7d' | '30d' | 'all' = '7d') {
    const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 365;
    const since = new Date(Date.now() - days * 86400000);

    const [events, categoryArticles, providerArticles] = await Promise.all([
      prisma.eventLog.findMany({
        where: {
          entityType: 'NEWS',
          createdAt: { gte: since },
        },
        select: { eventType: true, entityId: true, userId: true, createdAt: true },
      }),
      prisma.newsArticle.groupBy({
        by: ['category'],
        where: { status: 'PUBLISHED', deletedAt: null },
        _count: { id: true },
      }),
      prisma.newsArticle.groupBy({
        by: ['sourceName'],
        where: { status: 'PUBLISHED', deletedAt: null },
        _count: { id: true },
      }),
    ]);

    let totalOpens = 0;
    let totalSourceClicks = 0;
    let totalShares = 0;
    let totalSearches = 0;
    const uniqueUserSet = new Set<string>();

    events.forEach((ev) => {
      if (ev.userId) uniqueUserSet.add(ev.userId);
      if (ev.eventType === 'NEWS_OPENED') totalOpens++;
      if (ev.eventType === 'NEWS_SOURCE_OPENED') totalSourceClicks++;
      if (ev.eventType === 'NEWS_SHARED') totalShares++;
      if (ev.eventType === 'NEWS_SEARCHED') totalSearches++;
    });

    const ctr = totalOpens > 0 ? Math.round((totalSourceClicks / totalOpens) * 100) : 0;

    return {
      timeframe,
      metrics: {
        totalEvents: events.length,
        articleOpens: totalOpens,
        sourceClicks: totalSourceClicks,
        clickThroughRate: `${ctr}%`,
        shares: totalShares,
        searchQueries: totalSearches,
        uniqueReaders: uniqueUserSet.size,
      },
      categoryDistribution: categoryArticles.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
      sourceDistribution: providerArticles.map((p) => ({
        sourceName: p.sourceName,
        count: p._count.id,
      })),
    };
  }
}

export const newsOperationsService = new NewsOperationsService();
