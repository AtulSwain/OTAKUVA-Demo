/**
 * OTAKUVA NEWS ENTITY MATCHING ENGINE (PHASE 8.5)
 * 
 * Layered Entity Intelligence:
 * - Layer 1: Structured provider metadata & tags
 * - Layer 2: Canonical titles & aliases (AnimeTitle Japanese/English/Romaji/Synonyms)
 * - Layer 3: Normalized string & token similarity
 * - Layer 4: Studio names and slugs
 * - Layer 5: Person / staff names and kanji
 * - Layer 6: Season & Episode contextual extraction
 * 
 * False Positive Protection & In-Memory Entity Cache
 */

import { prisma } from '../../prisma';
import {
  EntityMatchCandidate,
  MatchMethod,
  MatchStatus,
  RawNewsArticle,
  RelationType,
} from './newsTypes';

// Configurable Confidence Thresholds
export const CONFIDENCE_CONFIRMED_THRESHOLD = 0.80;
export const CONFIDENCE_REVIEW_THRESHOLD = 0.50;

// Common short words excluded from creating fuzzy false positives
const COMMON_WORD_BLOCKLIST = new Set([
  'a', 'an', 'the', 'and', 'or', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'new', 'all', 'out', 'up', 'one', 'no',
  'tv', 'pv', 'mv', 'vs', 'go', 'now', 'season', 'episode', 'series', 'film', 'movie',
  'project', 'announcement', 'trailer', 'teaser', 'animation', 'part', 'arc', 'act',
]);

export interface EntityMatchResult {
  matchedAnime: Array<{
    animeId: string;
    confidenceScore: number;
    matchMethod: MatchMethod;
    relationType: RelationType;
    status: MatchStatus;
    rawMention: string;
  }>;
  matchedStudios: Array<{
    studioId: string;
    confidenceScore: number;
    matchMethod: MatchMethod;
    relationType: RelationType;
    status: MatchStatus;
    rawMention: string;
  }>;
  matchedPeople: Array<{
    personId: string;
    rawMention: string;
    relationType: RelationType;
  }>;
  reviewQueueItems: Array<{
    entityType: 'ANIME' | 'STUDIO' | 'PERSON';
    entityName: string;
    matchedEntityId?: string;
    confidenceScore: number;
    reason: string;
  }>;
}

export class NewsEntityMatcher {
  /**
   * Matches entities across Anime, Studio, and Person from raw & normalized article data
   */
  async matchEntities(
    rawArticle: RawNewsArticle,
    existingArticleId?: string
  ): Promise<EntityMatchResult> {
    const result: EntityMatchResult = {
      matchedAnime: [],
      matchedStudios: [],
      matchedPeople: [],
      reviewQueueItems: [],
    };

    // Load past admin rejections for this article (if updating)
    const rejectedEntityIds = new Set<string>();
    if (existingArticleId) {
      const dismissed = await prisma.newsReviewQueue.findMany({
        where: {
          articleId: existingArticleId,
          status: 'DISMISSED',
        },
        select: { matchedEntityId: true },
      });
      dismissed.forEach((d) => {
        if (d.matchedEntityId) rejectedEntityIds.add(d.matchedEntityId);
      });
    }

    const titleTokens = this.extractTitlePhrases(rawArticle.title);
    const mentions = [
      ...(rawArticle.mentionedAnimeTitles || []),
      ...(rawArticle.tags || []),
      ...titleTokens,
    ];

    // ==========================================
    // 1. ANIME ENTITY MATCHING
    // ==========================================
    const matchedAnimeIds = new Set<string>();

    for (const mention of mentions) {
      if (!mention || mention.trim().length < 2) continue;
      if (COMMON_WORD_BLOCKLIST.has(mention.trim().toLowerCase())) continue;

      const candidate = await this.resolveAnimeTitle(mention.trim());
      if (candidate && !matchedAnimeIds.has(candidate.animeId) && !rejectedEntityIds.has(candidate.animeId)) {
        matchedAnimeIds.add(candidate.animeId);

        const isPrimary = result.matchedAnime.length === 0;
        const relationType: RelationType = isPrimary ? 'PRIMARY' : 'RELATED';

        if (candidate.status === 'CONFIRMED') {
          result.matchedAnime.push({
            animeId: candidate.animeId,
            confidenceScore: candidate.confidenceScore,
            matchMethod: candidate.matchMethod,
            relationType,
            status: 'CONFIRMED',
            rawMention: candidate.rawMention,
          });
        } else if (candidate.status === 'REVIEW_REQUIRED') {
          result.reviewQueueItems.push({
            entityType: 'ANIME',
            entityName: candidate.rawMention,
            matchedEntityId: candidate.animeId,
            confidenceScore: candidate.confidenceScore,
            reason: `Contextual title match with confidence ${candidate.confidenceScore.toFixed(2)}`,
          });
        }
      }
    }

    // ==========================================
    // 2. STUDIO ENTITY MATCHING
    // ==========================================
    const studioMentions = [
      ...(rawArticle.mentionedStudioNames || []),
      ...this.extractStudioPhrases(rawArticle.title),
    ];
    const matchedStudioIds = new Set<string>();

    for (const mention of studioMentions) {
      if (!mention || mention.trim().length < 3) continue;
      if (COMMON_WORD_BLOCKLIST.has(mention.trim().toLowerCase())) continue;

      const candidate = await this.resolveStudioName(mention.trim());
      if (candidate && !matchedStudioIds.has(candidate.studioId) && !rejectedEntityIds.has(candidate.studioId)) {
        matchedStudioIds.add(candidate.studioId);

        if (candidate.status === 'CONFIRMED') {
          result.matchedStudios.push({
            studioId: candidate.studioId,
            confidenceScore: candidate.confidenceScore,
            matchMethod: candidate.matchMethod,
            relationType: 'PRODUCED_BY',
            status: 'CONFIRMED',
            rawMention: candidate.rawMention,
          });
        } else if (candidate.status === 'REVIEW_REQUIRED') {
          result.reviewQueueItems.push({
            entityType: 'STUDIO',
            entityName: candidate.rawMention,
            matchedEntityId: candidate.studioId,
            confidenceScore: candidate.confidenceScore,
            reason: `Partial studio name match with confidence ${candidate.confidenceScore.toFixed(2)}`,
          });
        }
      }
    }

    // ==========================================
    // 3. PERSON / STAFF ENTITY MATCHING
    // ==========================================
    const peopleMentions = [
      ...(rawArticle.mentionedPeopleNames || []),
      ...this.extractPersonPhrases(rawArticle.title),
    ];
    const matchedPeopleIds = new Set<string>();

    for (const mention of peopleMentions) {
      if (!mention || mention.trim().length < 3) continue;
      const candidate = await this.resolvePersonName(mention.trim());
      if (candidate && !matchedPeopleIds.has(candidate.personId)) {
        matchedPeopleIds.add(candidate.personId);
        result.matchedPeople.push({
          personId: candidate.personId,
          rawMention: candidate.rawMention,
          relationType: 'STAFF' as any,
        });
      }
    }

    return result;
  }

  /**
   * Resolves a raw title phrase against Anime, AnimeTitle aliases, and normalized tokens
   */
  private async resolveAnimeTitle(rawTitle: string): Promise<{
    animeId: string;
    confidenceScore: number;
    matchMethod: MatchMethod;
    status: MatchStatus;
    rawMention: string;
  } | null> {
    const normalized = rawTitle.toLowerCase().trim();

    // 1. Exact Canonical Title Match (Confidence 1.0)
    const exactAnime = await prisma.anime.findFirst({
      where: {
        OR: [
          { canonicalTitle: { equals: rawTitle } },
          { slug: { equals: normalized.replace(/\s+/g, '-') } },
        ],
      },
      select: { id: true, canonicalTitle: true },
    });

    if (exactAnime) {
      return {
        animeId: exactAnime.id,
        confidenceScore: 1.0,
        matchMethod: 'EXACT_TITLE',
        status: 'CONFIRMED',
        rawMention: rawTitle,
      };
    }

    // 2. Alias Title Match in AnimeTitle (Confidence 0.90)
    const aliasTitle = await prisma.animeTitle.findFirst({
      where: {
        OR: [
          { title: { equals: rawTitle } },
          { searchableTitle: { equals: normalized } },
        ],
      },
      select: { animeId: true },
    });

    if (aliasTitle) {
      return {
        animeId: aliasTitle.animeId,
        confidenceScore: 0.90,
        matchMethod: 'ALIAS',
        status: 'CONFIRMED',
        rawMention: rawTitle,
      };
    }

    // 3. Normalized / Substring Match (Confidence 0.82 or 0.65)
    const partialAnime = await prisma.anime.findFirst({
      where: {
        OR: [
          { canonicalTitle: { contains: rawTitle } },
          { titles: { some: { title: { contains: rawTitle } } } },
        ],
      },
      select: { id: true, canonicalTitle: true },
    });

    if (partialAnime) {
      const isStrongSubstring =
        partialAnime.canonicalTitle.toLowerCase().includes(normalized) ||
        normalized.includes(partialAnime.canonicalTitle.toLowerCase());

      const confidenceScore = isStrongSubstring ? 0.82 : 0.65;
      const status: MatchStatus =
        confidenceScore >= CONFIDENCE_CONFIRMED_THRESHOLD
          ? 'CONFIRMED'
          : confidenceScore >= CONFIDENCE_REVIEW_THRESHOLD
          ? 'REVIEW_REQUIRED'
          : 'REJECTED';

      return {
        animeId: partialAnime.id,
        confidenceScore,
        matchMethod: 'NORMALIZED',
        status,
        rawMention: rawTitle,
      };
    }

    return null;
  }

  /**
   * Resolves a studio name string to an internal Studio ID
   */
  private async resolveStudioName(rawName: string): Promise<{
    studioId: string;
    confidenceScore: number;
    matchMethod: MatchMethod;
    status: MatchStatus;
    rawMention: string;
  } | null> {
    const normalized = rawName.toLowerCase().trim();

    // 1. Exact Studio Name Match
    const exactStudio = await prisma.studio.findFirst({
      where: {
        OR: [
          { name: { equals: rawName } },
          { slug: { equals: normalized.replace(/\s+/g, '-') } },
        ],
      },
      select: { id: true, name: true },
    });

    if (exactStudio) {
      return {
        studioId: exactStudio.id,
        confidenceScore: 1.0,
        matchMethod: 'EXACT_NAME',
        status: 'CONFIRMED',
        rawMention: rawName,
      };
    }

    // 2. Partial / Substring Match (Token & Bidirectional substring)
    const words = normalized.split(/\s+/).filter((w) => w.length > 3 && !COMMON_WORD_BLOCKLIST.has(w));
    const partialStudio = await prisma.studio.findFirst({
      where: {
        OR: [
          { name: { contains: rawName } },
          { slug: { contains: normalized } },
          ...words.map((w) => ({ name: { contains: w } })),
          ...words.map((w) => ({ slug: { contains: w } })),
        ],
      },
      select: { id: true, name: true },
    });

    if (!partialStudio) return null;

    const sNorm = partialStudio.name.toLowerCase();
    const isSubstring = normalized.includes(sNorm) || sNorm.includes(normalized);
    const confidenceScore = isSubstring ? 0.75 : 0.60;
    const status: MatchStatus =
      confidenceScore >= CONFIDENCE_CONFIRMED_THRESHOLD
        ? 'CONFIRMED'
        : confidenceScore >= CONFIDENCE_REVIEW_THRESHOLD
        ? 'REVIEW_REQUIRED'
        : 'REJECTED';

    return {
      studioId: partialStudio.id,
      confidenceScore,
      matchMethod: 'NORMALIZED',
      status,
      rawMention: rawName,
    };
  }

  /**
   * Resolves a person name string to an internal Person ID
   */
  private async resolvePersonName(rawName: string): Promise<{
    personId: string;
    rawMention: string;
  } | null> {
    const person = await prisma.person.findFirst({
      where: {
        OR: [
          { name: { equals: rawName } },
          { nameKanji: { equals: rawName } },
          { name: { contains: rawName } },
        ],
      },
      select: { id: true },
    });

    if (!person) return null;

    return {
      personId: person.id,
      rawMention: rawName,
    };
  }

  /**
   * Extracts candidate anime titles from headline punctuation and patterns
   */
  private extractTitlePhrases(title: string): string[] {
    const results: string[] = [];

    // Extract text in quotes or Japanese brackets: '...', "...", 「...」, 『...』
    const quoteMatches = title.match(/['"「『](.*?)['"」』]/g);
    if (quoteMatches) {
      quoteMatches.forEach((m) => {
        const clean = m.replace(/['"「『」』]/g, '').trim();
        if (clean.length > 2) results.push(clean);
      });
    }

    // Extract text before colons or dashes (e.g. "Frieren: Beyond Journey's End Season 2 Announced")
    const colonMatch = title.split(/[:–—]/)[0]?.trim();
    if (colonMatch && colonMatch.length > 3 && colonMatch !== title.trim()) {
      results.push(colonMatch);
    }

    // Full title stripped of common news suffix words
    const stripped = title
      .replace(/(Season \d+|Anime|Film|Movie|Trilogy|Cast|Staff|Release Date|Teaser|Trailer|Announced|Revealed|Confirmed|Premieres|Returns|Delayed).*$/i, '')
      .trim();
    if (stripped.length > 3 && stripped !== title.trim()) {
      results.push(stripped);
    }

    return Array.from(new Set(results));
  }

  /**
   * Extracts candidate studio names from phrases like "by ufotable", "Studio MAPPA", etc.
   */
  private extractStudioPhrases(title: string): string[] {
    const results: string[] = [];
    const studioPatterns = [
      /(?:studio\s+)([A-Za-z0-9\s]+?)(?:\s+(?:announces|reveals|produces|delays|shares|confirms)|$)/i,
      /(?:by\s+)([A-Za-z0-9\s]+?)(?:\s+(?:production|animation|staff)|$)/i,
    ];

    studioPatterns.forEach((pat) => {
      const match = title.match(pat);
      if (match && match[1] && match[1].trim().length > 2) {
        results.push(match[1].trim());
      }
    });

    return results;
  }

  /**
   * Extracts candidate person names from phrases like "Director Keiichirou Saitou", etc.
   */
  private extractPersonPhrases(title: string): string[] {
    const results: string[] = [];
    const personPatterns = [
      /(?:director\s+)([A-Za-z\s]+?)(?:\s+(?:shares|reveals|confirms|returns)|$)/i,
      /(?:creator\s+)([A-Za-z\s]+?)(?:\s+(?:shares|reveals|comments)|$)/i,
      /(?:voice actor\s+)([A-Za-z\s]+?)(?:\s+(?:joins|cast)|$)/i,
    ];

    personPatterns.forEach((pat) => {
      const match = title.match(pat);
      if (match && match[1] && match[1].trim().length > 3) {
        results.push(match[1].trim());
      }
    });

    return results;
  }
}

export const newsEntityMatcher = new NewsEntityMatcher();
