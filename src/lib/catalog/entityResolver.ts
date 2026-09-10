/**
 * OTAKUVA ANIME CATALOG & DATA INGESTION ENGINE — PHASE 13
 * MULTI-STAGE ENTITY RESOLUTION & DEDUPLICATION ENGINE (13.15 → 13.20 & 13.42)
 * 
 * Multi-stage candidate matching pipeline:
 * Stage 1: Exact External ID match (MAL ID, AniList ID, Provider External ID)
 * Stage 2: Exact Normalized Slug & Title match
 * Stage 3: Title + Year + Format match
 * Stage 4: Multi-language Synonym & Japanese title match
 * Stage 5: N-gram & Levenshtein fuzzy string similarity
 * 
 * Over-Merge Protections:
 * - Prevents merging sequels (e.g. "Season 1" vs "Season 2")
 * - Prevents merging TV series with standalone Movies/OVAs
 * - Prevents merging remakes across different decades
 */

import { prisma } from '../prisma';
import { NormalizedAnimePayload, CatalogNormalizer } from './normalizer';

export type ResolutionConfidence = 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'LOW_CONFIDENCE';

export interface EntityResolutionResult {
  isMatch: boolean;
  canonicalAnimeId?: string;
  matchedEntityTitle?: string;
  confidence: ResolutionConfidence;
  confidenceScore: number;
  matchReason: string;
  isSequelOrDerivative?: boolean;
}

export class EntityResolver {
  /**
   * Computes Levenshtein edit distance between two strings
   */
  private static levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Computes string similarity score between 0.0 and 1.0
   */
  static calculateSimilarity(s1: string, s2: string): number {
    const norm1 = CatalogNormalizer.generateSearchKey(s1);
    const norm2 = CatalogNormalizer.generateSearchKey(s2);
    if (norm1 === norm2) return 1.0;
    if (!norm1 || !norm2) return 0.0;

    const maxLen = Math.max(norm1.length, norm2.length);
    const dist = this.levenshteinDistance(norm1, norm2);
    return Math.max(0, 1 - dist / maxLen);
  }

  /**
   * Checks if candidate title indicates a sequel, season, or movie variant
   */
  static isDerivativeVariant(titleA: string, titleB: string): boolean {
    const seasonRegex = /(?:season\s*\d+|2nd\s*season|3rd\s*season|4th\s*season|part\s*\d+|s\d+|\bii\b|\biii\b|\biv\b)/i;
    const movieRegex = /(?:movie|film|the\s*movie|gekijouban)/i;

    const aHasSeason = seasonRegex.test(titleA);
    const bHasSeason = seasonRegex.test(titleB);
    const aHasMovie = movieRegex.test(titleA);
    const bHasMovie = movieRegex.test(titleB);

    if (aHasSeason !== bHasSeason) return true;
    if (aHasMovie !== bHasMovie) return true;
    return false;
  }

  /**
   * Resolves raw imported anime payload against existing OTAKUVA database
   */
  static async resolveEntity(payload: NormalizedAnimePayload): Promise<EntityResolutionResult> {
    // -------------------------------------------------------------
    // STAGE 1: Exact External ID Match (1.0 Confidence)
    // -------------------------------------------------------------
    const externalIdMatch = await prisma.anime.findFirst({
      where: {
        OR: [
          { externalIds: { some: { provider: payload.externalSource, externalId: payload.externalId } } },
          ...(payload.anilistId ? [{ anilistId: payload.anilistId }] : []),
          ...(payload.malId ? [{ malId: payload.malId }] : []),
        ],
      },
      select: { id: true, canonicalTitle: true, slug: true, type: true, year: true },
    });

    if (externalIdMatch) {
      return {
        isMatch: true,
        canonicalAnimeId: externalIdMatch.id,
        matchedEntityTitle: externalIdMatch.canonicalTitle,
        confidence: 'HIGH_CONFIDENCE',
        confidenceScore: 1.0,
        matchReason: `Exact external ID match on provider ${payload.externalSource}:${payload.externalId}`,
      };
    }

    // -------------------------------------------------------------
    // STAGE 2: Exact Slug or Title + Format + Year Match (0.95 Confidence)
    // -------------------------------------------------------------
    const exactSlugOrTitle = await prisma.anime.findFirst({
      where: {
        OR: [
          { slug: payload.slug },
          { canonicalTitle: payload.canonicalTitle },
        ],
      },
      select: { id: true, canonicalTitle: true, slug: true, type: true, year: true },
    });

    if (exactSlugOrTitle) {
      // Over-merge protection check: verify format and year alignment
      const formatMatches = !exactSlugOrTitle.type || exactSlugOrTitle.type === payload.type;
      const yearMatches = !exactSlugOrTitle.year || !payload.year || Math.abs(exactSlugOrTitle.year - payload.year) <= 1;

      if (formatMatches && yearMatches) {
        return {
          isMatch: true,
          canonicalAnimeId: exactSlugOrTitle.id,
          matchedEntityTitle: exactSlugOrTitle.canonicalTitle,
          confidence: 'HIGH_CONFIDENCE',
          confidenceScore: 0.95,
          matchReason: `Exact slug/title match with matching format (${payload.type}) and year`,
        };
      }
    }

    // -------------------------------------------------------------
    // STAGE 3: Multi-Language Synonym & Alternative Title Cross-Match (0.90 Confidence)
    // -------------------------------------------------------------
    for (const titleEntry of payload.titles) {
      const altMatch = await prisma.animeTitle.findFirst({
        where: {
          searchableTitle: CatalogNormalizer.generateSearchKey(titleEntry.title),
        },
        include: {
          anime: { select: { id: true, canonicalTitle: true, type: true, year: true } },
        },
      });

      if (altMatch && altMatch.anime) {
        const isDerivative = this.isDerivativeVariant(payload.canonicalTitle, altMatch.anime.canonicalTitle);
        if (!isDerivative && altMatch.anime.type === payload.type) {
          return {
            isMatch: true,
            canonicalAnimeId: altMatch.anime.id,
            matchedEntityTitle: altMatch.anime.canonicalTitle,
            confidence: 'HIGH_CONFIDENCE',
            confidenceScore: 0.90,
            matchReason: `Multi-language title match on alias "${titleEntry.title}"`,
          };
        }
      }
    }

    // -------------------------------------------------------------
    // STAGE 4: Fuzzy String Similarity Search (0.65 - 0.88 Confidence)
    // -------------------------------------------------------------
    const candidates = await prisma.anime.findMany({
      where: {
        type: payload.type,
        ...(payload.year ? { year: { gte: payload.year - 2, lte: payload.year + 2 } } : {}),
      },
      take: 20,
      select: { id: true, canonicalTitle: true, type: true, year: true },
    });

    let bestCandidate: { id: string; title: string; score: number } | null = null;

    for (const cand of candidates) {
      const similarity = this.calculateSimilarity(payload.canonicalTitle, cand.canonicalTitle);
      const isDerivative = this.isDerivativeVariant(payload.canonicalTitle, cand.canonicalTitle);

      if (isDerivative) continue; // Skip sequels/derivatives from merging

      if (similarity > (bestCandidate?.score || 0)) {
        bestCandidate = { id: cand.id, title: cand.canonicalTitle, score: similarity };
      }
    }

    if (bestCandidate && bestCandidate.score >= 0.88) {
      return {
        isMatch: true,
        canonicalAnimeId: bestCandidate.id,
        matchedEntityTitle: bestCandidate.title,
        confidence: 'HIGH_CONFIDENCE',
        confidenceScore: bestCandidate.score,
        matchReason: `High fuzzy similarity (${(bestCandidate.score * 100).toFixed(1)}%)`,
      };
    } else if (bestCandidate && bestCandidate.score >= 0.65) {
      return {
        isMatch: false, // Flag for review rather than auto-merge
        canonicalAnimeId: bestCandidate.id,
        matchedEntityTitle: bestCandidate.title,
        confidence: 'MEDIUM_CONFIDENCE',
        confidenceScore: bestCandidate.score,
        matchReason: `Medium fuzzy match (${(bestCandidate.score * 100).toFixed(1)}%). Recommended for Admin Review`,
      };
    }

    // -------------------------------------------------------------
    // STAGE 5: No Match -> Brand New Canonical Entity
    // -------------------------------------------------------------
    return {
      isMatch: false,
      confidence: 'LOW_CONFIDENCE',
      confidenceScore: 0.0,
      matchReason: 'Brand new distinct anime entity. No duplicates detected.',
    };
  }
}
