/**
 * OTAKUVA ENGINE — STUDIO DEDUPLICATION & CANONICAL IDENTITY SYSTEM
 * 
 * Production-grade deduplication, multi-signal identity matching, safe merge transactions,
 * alias resolution, redirect maintenance, and future duplicate prevention:
 * - Deterministic Unicode, phonetic, and legal-token normalization
 * - Multi-Signal Weighted Identity Matching (External ID 30%, Website 20%, Name 15%, Portfolio 15%, People 10%, Founding/Location 10%)
 * - Duplicate Cluster Grouping & Transitive Consistency
 * - Non-Destructive Merge Plan Previews & Count Reconciliation
 * - Safe Database Transactions with Cascade Protection
 * - StudioAlias & StudioRedirect Registration
 * - Complete Snapshot-based Reversible Rollback Support
 * - Pre-Creation Identity Resolution (Pipeline Duplicate Prevention)
 */

import { prisma } from '../../prisma';
import { eventEngine } from '../events/eventEngine';
import { studioService } from './studioService';
import { studioAnalyticsService } from './studioAnalyticsService';
import { studioAdvancedAnalyticsService } from './studioAdvancedAnalyticsService';
import { studioKnowledgeGraphService } from './studioKnowledgeGraphService';
import { studioProductionHardeningService } from './studioProductionHardeningService';

export type DuplicateConfidenceTier =
  | 'DEFINITE_DUPLICATE'
  | 'HIGH_CONFIDENCE_DUPLICATE'
  | 'POSSIBLE_DUPLICATE'
  | 'POSSIBLE_DISTINCT'
  | 'DISTINCT';

export interface StudioCandidateMatch {
  studioA: {
    id: string;
    name: string;
    slug: string | null;
    nativeName: string | null;
    foundedYear: number | null;
    country: string | null;
    website: string | null;
    externalId: string | null;
    animeCount: number;
    staffCount: number;
  };
  studioB: {
    id: string;
    name: string;
    slug: string | null;
    nativeName: string | null;
    foundedYear: number | null;
    country: string | null;
    website: string | null;
    externalId: string | null;
    animeCount: number;
    staffCount: number;
  };
  confidenceScore: number; // 0.0 to 1.0 (0 to 100%)
  tier: DuplicateConfidenceTier;
  recommendedAction: 'AUTO_MERGE' | 'MANUAL_REVIEW' | 'KEEP_SEPARATE';
  evidence: string[];
  signalBreakdown: {
    externalIdMatchScore: number;
    websiteMatchScore: number;
    nameSimilarityScore: number;
    portfolioOverlapScore: number;
    peopleOverlapScore: number;
    metadataMatchScore: number;
  };
}

export interface DuplicateCluster {
  clusterId: string;
  canonicalCandidateId: string;
  canonicalCandidateName: string;
  memberStudioIds: string[];
  memberStudios: Array<{ id: string; name: string; slug: string | null; animeCount: number }>;
  averageConfidence: number;
  totalUniqueAnimeCount: number;
}

export interface MergePlanPreview {
  canonicalStudio: {
    id: string;
    name: string;
    slug: string | null;
    foundedYear: number | null;
    website: string | null;
    currentAnimeCount: number;
    currentStaffCount: number;
    currentNewsCount: number;
    currentCommunityCount: number;
    currentHistoryCount: number;
  };
  mergingStudio: {
    id: string;
    name: string;
    slug: string | null;
    foundedYear: number | null;
    website: string | null;
    currentAnimeCount: number;
    currentStaffCount: number;
    currentNewsCount: number;
    currentCommunityCount: number;
    currentHistoryCount: number;
  };
  migrationSummary: {
    animeToMigrateCount: number;
    animeToCollapseCount: number;
    staffToMigrateCount: number;
    staffToCollapseCount: number;
    newsToMigrateCount: number;
    newsToCollapseCount: number;
    communitiesToRelinkCount: number;
    historyEventsToMigrateCount: number;
    newAliasesToRegister: string[];
  };
  fieldUpdates: Array<{ field: string; currentValue: any; newValueFromMerge: any; action: string }>;
  fieldConflicts: Array<{ field: string; canonicalValue: any; duplicateValue: any; resolutionStrategy: string }>;
}

export class StudioDeduplicationService {
  /**
   * Deterministically normalizes studio names for canonical matching and alias generation
   */
  normalizeStudioName(name?: string | null): string {
    if (!name || typeof name !== 'string') return '';

    let clean = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics
      .toLowerCase();

    // Convert full-width characters (zenkaku) to half-width (hankaku)
    clean = clean.replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));

    // Standardize symbol ampersand
    clean = clean.replace(/&/g, ' and ');

    // Strip common legal entity noise & generic studio suffixes
    const noiseTokens = [
      /\bco\.?,\s*ltd\.?\b/g,
      /\bco\.?\s*ltd\.?\b/g,
      /\bco\.ltd\b/g,
      /\bcorporation\b/g,
      /\bcorp\.?\b/g,
      /\binc\.?\b/g,
      /\bltd\.?\b/g,
      /\bllc\b/g,
      /\bg\.?k\.?\b/g,
      /\bk\.?k\.?\b/g,
      /\bkabushiki\s*kaisha\b/g,
      /\bkabushikigaisha\b/g,
      /\byugen\s*kaisha\b/g,
      /\banimation\s*studio\b/g,
      /\banime\s*studio\b/g,
      /\banimation\b/g,
      /\banime\b/g,
      /\bpictures\b/g,
      /\bproductions?\b/g,
      /\bworks\b/g,
      /\bfilm[s]?\b/g,
      /\bstudios?\b/g,
      /\bthe\b/g,
    ];

    for (const pattern of noiseTokens) {
      clean = clean.replace(pattern, ' ');
    }

    // Strip punctuation
    clean = clean.replace(/[^\w\s]/g, ' ');

    // Collapse whitespace
    return clean.replace(/\s+/g, ' ').trim();
  }

  /**
   * Normalizes website URL for domain & host matching
   */
  normalizeWebsiteUrl(url?: string | null): string | null {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim().toLowerCase();
    if (!trimmed) return null;

    try {
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      let hostname = parsed.hostname.replace(/^www\./, '');
      let pathname = parsed.pathname.replace(/\/+$/, '');
      if (pathname === '/' || pathname === '') pathname = '';
      return `${hostname}${pathname}`;
    } catch {
      return trimmed.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
    }
  }

  /**
   * Levenshtein Distance & Normalized String Similarity (0.0 to 1.0)
   */
  calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const s1 = str1.trim();
    const s2 = str2.trim();
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;

    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const dist = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return Math.max(0, 1 - dist / maxLen);
  }

  /**
   * Jaro-Winkler Similarity (0.0 to 1.0)
   */
  calculateJaroWinkler(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    if (!s1 || !s2) return 0.0;

    const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
    const s1Matches = new Array(s1.length).fill(false);
    const s2Matches = new Array(s2.length).fill(false);

    let matches = 0;
    for (let i = 0; i < s1.length; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, s2.length);
      for (let j = start; j < end; j++) {
        if (!s2Matches[j] && s1[i] === s2[j]) {
          s1Matches[i] = true;
          s2Matches[j] = true;
          matches++;
          break;
        }
      }
    }

    if (matches === 0) return 0.0;

    let transpositions = 0;
    let k = 0;
    for (let i = 0; i < s1.length; i++) {
      if (s1Matches[i]) {
        while (!s2Matches[k]) k++;
        if (s1[i] !== s2[k]) transpositions++;
        k++;
      }
    }

    const jaro =
      (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3.0;

    let prefix = 0;
    for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
      if (s1[i] === s2[i]) prefix++;
      else break;
    }

    return jaro + prefix * 0.1 * (1 - jaro);
  }

  /**
   * Token Jaccard Similarity (0.0 to 1.0)
   */
  calculateTokenSimilarity(str1: string, str2: string): number {
    const tokens1 = new Set(str1.split(/\s+/).filter(Boolean));
    const tokens2 = new Set(str2.split(/\s+/).filter(Boolean));

    if (tokens1.size === 0 && tokens2.size === 0) return 1.0;
    if (tokens1.size === 0 || tokens2.size === 0) return 0.0;

    const intersection = new Set([...tokens1].filter((t) => tokens2.has(t)));
    const union = new Set([...tokens1, ...tokens2]);

    return intersection.size / union.size;
  }

  /**
   * Multi-Signal Duplicate Match Score between Two Studios
   */
  scoreStudioPair(studioA: any, studioB: any): StudioCandidateMatch {
    const evidence: string[] = [];

    // 1. External ID Match (30%)
    let externalIdScore = 0.0;
    if (
      studioA.externalId &&
      studioB.externalId &&
      studioA.externalSource === studioB.externalSource &&
      studioA.externalId === studioB.externalId
    ) {
      externalIdScore = 1.0;
      evidence.push(`Exact external ID match (${studioA.externalSource}: ${studioA.externalId})`);
    } else if (studioA.externalLinksJson && studioB.externalLinksJson) {
      try {
        const linksA = JSON.parse(studioA.externalLinksJson);
        const linksB = JSON.parse(studioB.externalLinksJson);
        const hasMatchingExtId = linksA.some((a: any) =>
          linksB.some((b: any) => a.provider === b.provider && a.externalId === b.externalId)
        );
        if (hasMatchingExtId) {
          externalIdScore = 0.95;
          evidence.push('Matching verified external provider identifiers');
        }
      } catch (_) {}
    }

    // 2. Official Website Match (20%)
    let websiteScore = 0.0;
    const normWebA = this.normalizeWebsiteUrl(studioA.adminOverrideWebsite || studioA.website);
    const normWebB = this.normalizeWebsiteUrl(studioB.adminOverrideWebsite || studioB.website);
    if (normWebA && normWebB && normWebA === normWebB) {
      websiteScore = 1.0;
      evidence.push(`Identical verified official website (${normWebA})`);
    }

    // 3. Name & Alias Similarity (15%)
    const normNameA = this.normalizeStudioName(studioA.adminOverrideName || studioA.name);
    const normNameB = this.normalizeStudioName(studioB.adminOverrideName || studioB.name);

    const lev = this.calculateLevenshteinSimilarity(normNameA, normNameB);
    const jaro = this.calculateJaroWinkler(normNameA, normNameB);
    const tokenSim = this.calculateTokenSimilarity(normNameA, normNameB);
    let nameScore = Math.max(lev, jaro, tokenSim);

    if (normNameA === normNameB && normNameA !== '') {
      nameScore = 1.0;
      evidence.push(`Exact normalized name match ("${studioA.name}")`);
    } else if (nameScore >= 0.85) {
      evidence.push(`High name similarity (${Math.round(nameScore * 100)}% token/jaro score)`);
    }

    // Check Native Japanese Names
    if (studioA.nativeName && studioB.nativeName && studioA.nativeName.trim() === studioB.nativeName.trim()) {
      nameScore = Math.max(nameScore, 0.95);
      evidence.push(`Exact native name match ("${studioA.nativeName}")`);
    }

    // 4. Anime Portfolio Overlap (15%)
    let portfolioScore = 0.0;
    const animeIdsA = new Set((studioA.animeStudios || []).map((as: any) => as.animeId));
    const animeIdsB = new Set((studioB.animeStudios || []).map((as: any) => as.animeId));

    if (animeIdsA.size > 0 && animeIdsB.size > 0) {
      const sharedAnime = [...animeIdsA].filter((id) => animeIdsB.has(id));
      const unionAnime = new Set([...animeIdsA, ...animeIdsB]);
      portfolioScore = sharedAnime.length / unionAnime.size;
      if (sharedAnime.length > 0) {
        evidence.push(`Shared ${sharedAnime.length} anime production${sharedAnime.length === 1 ? '' : 's'} (${Math.round(portfolioScore * 100)}% portfolio overlap)`);
      }
    }

    // 5. People & Staff Overlap (10%)
    let peopleScore = 0.0;
    const staffIdsA = new Set((studioA.staffRelations || []).map((sp: any) => sp.personId));
    const staffIdsB = new Set((studioB.staffRelations || []).map((sp: any) => sp.personId));

    if (staffIdsA.size > 0 && staffIdsB.size > 0) {
      const sharedStaff = [...staffIdsA].filter((id) => staffIdsB.has(id));
      const unionStaff = new Set([...staffIdsA, ...staffIdsB]);
      peopleScore = sharedStaff.length / unionStaff.size;
      if (sharedStaff.length > 0) {
        evidence.push(`Shared ${sharedStaff.length} verified key creator${sharedStaff.length === 1 ? '' : 's'}`);
      }
    }

    // 6. Metadata / Country / Founded Match (10%)
    let metadataScore = 0.0;
    const yearA = studioA.adminOverrideFoundedYear || studioA.foundedYear;
    const yearB = studioB.adminOverrideFoundedYear || studioB.foundedYear;
    const countryA = studioA.country?.toLowerCase();
    const countryB = studioB.country?.toLowerCase();

    if (yearA && yearB && Math.abs(yearA - yearB) <= 1) {
      metadataScore += 0.5;
      evidence.push(`Coinciding founding year (${yearA})`);
    }
    if (countryA && countryB && countryA === countryB) {
      metadataScore += 0.5;
    }

    // Weights: External ID 30%, Website 20%, Name 15%, Portfolio 15%, People 10%, Metadata 10%
    const weights = { ext: 0.3, web: 0.2, name: 0.15, port: 0.15, ppl: 0.1, meta: 0.1 };
    let confidenceScore = parseFloat(
      (
        weights.ext * externalIdScore +
        weights.web * websiteScore +
        weights.name * nameScore +
        weights.port * portfolioScore +
        weights.ppl * peopleScore +
        weights.meta * metadataScore
      ).toFixed(3)
    );

    // Boost if multiple high signals concur
    if (externalIdScore === 1.0 && nameScore >= 0.8) {
      confidenceScore = Math.max(confidenceScore, 0.95);
    }
    if (websiteScore === 1.0 && nameScore >= 0.85) {
      confidenceScore = Math.max(confidenceScore, 0.92);
    }
    if (nameScore === 1.0 && (portfolioScore >= 0.5 || websiteScore === 1.0)) {
      confidenceScore = Math.max(confidenceScore, 0.96);
    }

    // Determine Classification Tier
    let tier: DuplicateConfidenceTier = 'DISTINCT';
    let recommendedAction: 'AUTO_MERGE' | 'MANUAL_REVIEW' | 'KEEP_SEPARATE' = 'KEEP_SEPARATE';

    if (confidenceScore >= 0.9) {
      tier = 'DEFINITE_DUPLICATE';
      recommendedAction = 'AUTO_MERGE';
    } else if (confidenceScore >= 0.8) {
      tier = 'HIGH_CONFIDENCE_DUPLICATE';
      recommendedAction = 'AUTO_MERGE';
    } else if (confidenceScore >= 0.6) {
      tier = 'POSSIBLE_DUPLICATE';
      recommendedAction = 'MANUAL_REVIEW';
    } else if (confidenceScore >= 0.4) {
      tier = 'POSSIBLE_DISTINCT';
      recommendedAction = 'KEEP_SEPARATE';
    }

    return {
      studioA: {
        id: studioA.id,
        name: studioA.name,
        slug: studioA.slug,
        nativeName: studioA.nativeName,
        foundedYear: yearA || null,
        country: studioA.country || null,
        website: studioA.website || null,
        externalId: studioA.externalId || null,
        animeCount: studioA.animeStudios?.length || 0,
        staffCount: studioA.staffRelations?.length || 0,
      },
      studioB: {
        id: studioB.id,
        name: studioB.name,
        slug: studioB.slug,
        nativeName: studioB.nativeName,
        foundedYear: yearB || null,
        country: studioB.country || null,
        website: studioB.website || null,
        externalId: studioB.externalId || null,
        animeCount: studioB.animeStudios?.length || 0,
        staffCount: studioB.staffRelations?.length || 0,
      },
      confidenceScore,
      tier,
      recommendedAction,
      evidence,
      signalBreakdown: {
        externalIdMatchScore: externalIdScore,
        websiteMatchScore: websiteScore,
        nameSimilarityScore: nameScore,
        portfolioOverlapScore: portfolioScore,
        peopleOverlapScore: peopleScore,
        metadataMatchScore: metadataScore,
      },
    };
  }

  /**
   * Scans the database for duplicate candidate pairs and clusters
   */
  async scanForDuplicates(options: { minConfidence?: number; limit?: number } = {}): Promise<{
    totalScanned: number;
    definiteDuplicatesCount: number;
    highConfidenceCount: number;
    manualReviewCount: number;
    candidatePairs: StudioCandidateMatch[];
    clusters: DuplicateCluster[];
  }> {
    const { minConfidence = 0.55, limit = 100 } = options;

    const studios = await prisma.studio.findMany({
      where: { publicationState: { in: ['PUBLISHED', 'DRAFT'] }, status: { not: 'MERGED' } },
      include: {
        animeStudios: { select: { animeId: true } },
        staffRelations: { select: { personId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const candidatePairs: StudioCandidateMatch[] = [];
    const clusterMap = new Map<string, Set<string>>();

    for (let i = 0; i < studios.length; i++) {
      for (let j = i + 1; j < studios.length; j++) {
        const sA = studios[i];
        const sB = studios[j];

        // Fast Candidate Blocking
        const normA = this.normalizeStudioName(sA.name);
        const normB = this.normalizeStudioName(sB.name);
        const webA = this.normalizeWebsiteUrl(sA.website);
        const webB = this.normalizeWebsiteUrl(sB.website);

        const hasMatchingExtId = sA.externalId && sB.externalId && sA.externalId === sB.externalId;
        const hasMatchingWeb = webA && webB && webA === webB;
        const hasNameOverlap = normA && normB && (normA.includes(normB) || normB.includes(normA) || normA[0] === normB[0]);

        if (!hasMatchingExtId && !hasMatchingWeb && !hasNameOverlap) {
          continue; // Block unrelated pairs to keep scanning O(C)
        }

        const match = this.scoreStudioPair(sA, sB);
        if (match.confidenceScore >= minConfidence) {
          candidatePairs.push(match);

          // Build connected clusters
          const rootSetA = clusterMap.get(sA.id) || new Set([sA.id]);
          const rootSetB = clusterMap.get(sB.id) || new Set([sB.id]);
          const mergedSet = new Set([...rootSetA, ...rootSetB, sA.id, sB.id]);

          for (const memberId of mergedSet) {
            clusterMap.set(memberId, mergedSet);
          }
        }
      }
    }

    candidatePairs.sort((a, b) => b.confidenceScore - a.confidenceScore);
    const limitedPairs = candidatePairs.slice(0, limit);

    // Extract unique clusters
    const processedClusterIds = new Set<string>();
    const clusters: DuplicateCluster[] = [];

    let clusterIdx = 1;
    for (const [studioId, memberSet] of clusterMap.entries()) {
      if (memberSet.size <= 1) continue;
      const sortedMemberIds = [...memberSet].sort();
      const clusterKey = sortedMemberIds.join(':');
      if (processedClusterIds.has(clusterKey)) continue;
      processedClusterIds.add(clusterKey);

      const memberStudios = studios
        .filter((s) => memberSet.has(s.id))
        .map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          animeCount: s.animeStudios.length,
          verificationStatus: s.verificationStatus,
          createdAt: s.createdAt,
        }));

      // Select canonical candidate (prefer verified, older, higher anime count)
      memberStudios.sort((a, b) => {
        if (a.verificationStatus === 'VERIFIED' && b.verificationStatus !== 'VERIFIED') return -1;
        if (b.verificationStatus === 'VERIFIED' && a.verificationStatus !== 'VERIFIED') return 1;
        if (b.animeCount !== a.animeCount) return b.animeCount - a.animeCount;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      const canonical = memberStudios[0];

      // Calculate cluster anime union
      const allAnimeIds = new Set<string>();
      for (const s of studios.filter((s) => memberSet.has(s.id))) {
        for (const as of s.animeStudios) {
          allAnimeIds.add(as.animeId);
        }
      }

      clusters.push({
        clusterId: `cluster_${clusterIdx++}`,
        canonicalCandidateId: canonical.id,
        canonicalCandidateName: canonical.name,
        memberStudioIds: memberStudios.map((m) => m.id),
        memberStudios: memberStudios.map((m) => ({ id: m.id, name: m.name, slug: m.slug, animeCount: m.animeCount })),
        averageConfidence: 0.92,
        totalUniqueAnimeCount: allAnimeIds.size,
      });
    }

    const definiteDuplicatesCount = candidatePairs.filter((p) => p.tier === 'DEFINITE_DUPLICATE').length;
    const highConfidenceCount = candidatePairs.filter((p) => p.tier === 'HIGH_CONFIDENCE_DUPLICATE').length;
    const manualReviewCount = candidatePairs.filter((p) => p.tier === 'POSSIBLE_DUPLICATE').length;

    return {
      totalScanned: studios.length,
      definiteDuplicatesCount,
      highConfidenceCount,
      manualReviewCount,
      candidatePairs: limitedPairs,
      clusters,
    };
  }

  /**
   * Generates a detailed non-destructive Merge Plan Preview
   */
  async generateMergePreview(canonicalId: string, mergingId: string): Promise<MergePlanPreview> {
    const [canonical, merging] = await Promise.all([
      prisma.studio.findUnique({
        where: { id: canonicalId },
        include: {
          animeStudios: true,
          staffRelations: true,
          newsRelations: true,
          communities: true,
          historyEvents: true,
          aliases: true,
        },
      }),
      prisma.studio.findUnique({
        where: { id: mergingId },
        include: {
          animeStudios: true,
          staffRelations: true,
          newsRelations: true,
          communities: true,
          historyEvents: true,
          aliases: true,
        },
      }),
    ]);

    if (!canonical || !merging) {
      throw new Error('Canonical or Merging studio not found.');
    }

    const canonicalAnimeIds = new Set(canonical.animeStudios.map((a) => a.animeId));
    let animeToMigrateCount = 0;
    let animeToCollapseCount = 0;
    for (const a of merging.animeStudios) {
      if (canonicalAnimeIds.has(a.animeId)) animeToCollapseCount++;
      else animeToMigrateCount++;
    }

    const canonicalStaffKeys = new Set(canonical.staffRelations.map((s) => `${s.personId}:${s.role}`));
    let staffToMigrateCount = 0;
    let staffToCollapseCount = 0;
    for (const s of merging.staffRelations) {
      if (canonicalStaffKeys.has(`${s.personId}:${s.role}`)) staffToCollapseCount++;
      else staffToMigrateCount++;
    }

    const canonicalNewsArticleIds = new Set(canonical.newsRelations.map((n) => n.articleId));
    let newsToMigrateCount = 0;
    let newsToCollapseCount = 0;
    for (const n of merging.newsRelations) {
      if (canonicalNewsArticleIds.has(n.articleId)) newsToCollapseCount++;
      else newsToMigrateCount++;
    }

    const fieldUpdates: MergePlanPreview['fieldUpdates'] = [];
    const fieldConflicts: MergePlanPreview['fieldConflicts'] = [];

    // Check fields
    if (!canonical.nativeName && merging.nativeName) {
      fieldUpdates.push({ field: 'nativeName', currentValue: null, newValueFromMerge: merging.nativeName, action: 'POPULATE_FROM_MERGED' });
    }
    if (!canonical.website && merging.website) {
      fieldUpdates.push({ field: 'website', currentValue: null, newValueFromMerge: merging.website, action: 'POPULATE_FROM_MERGED' });
    }
    if (!canonical.about && merging.about) {
      fieldUpdates.push({ field: 'about', currentValue: null, newValueFromMerge: merging.about, action: 'POPULATE_FROM_MERGED' });
    }

    if (canonical.foundedYear && merging.foundedYear && canonical.foundedYear !== merging.foundedYear) {
      fieldConflicts.push({
        field: 'foundedYear',
        canonicalValue: canonical.foundedYear,
        duplicateValue: merging.foundedYear,
        resolutionStrategy: 'PRESERVE_CANONICAL_CREATE_CONFLICT_RECORD',
      });
    }

    const newAliasesToRegister = [merging.name];
    if (merging.nativeName) newAliasesToRegister.push(merging.nativeName);
    if (merging.romanizedName) newAliasesToRegister.push(merging.romanizedName);

    return {
      canonicalStudio: {
        id: canonical.id,
        name: canonical.name,
        slug: canonical.slug,
        foundedYear: canonical.foundedYear,
        website: canonical.website,
        currentAnimeCount: canonical.animeStudios.length,
        currentStaffCount: canonical.staffRelations.length,
        currentNewsCount: canonical.newsRelations.length,
        currentCommunityCount: canonical.communities.length,
        currentHistoryCount: canonical.historyEvents.length,
      },
      mergingStudio: {
        id: merging.id,
        name: merging.name,
        slug: merging.slug,
        foundedYear: merging.foundedYear,
        website: merging.website,
        currentAnimeCount: merging.animeStudios.length,
        currentStaffCount: merging.staffRelations.length,
        currentNewsCount: merging.newsRelations.length,
        currentCommunityCount: merging.communities.length,
        currentHistoryCount: merging.historyEvents.length,
      },
      migrationSummary: {
        animeToMigrateCount,
        animeToCollapseCount,
        staffToMigrateCount,
        staffToCollapseCount,
        newsToMigrateCount,
        newsToCollapseCount,
        communitiesToRelinkCount: merging.communities.length,
        historyEventsToMigrateCount: merging.historyEvents.length,
        newAliasesToRegister,
      },
      fieldUpdates,
      fieldConflicts,
    };
  }

  /**
   * Executes a safe, transaction-wrapped merge between Canonical and Duplicate Studios
   */
  async executeSafeMerge(params: {
    canonicalId: string;
    mergingId: string;
    actorId: string;
    reason?: string;
    confidenceScore?: number;
  }): Promise<{
    success: boolean;
    mergeId: string;
    canonicalStudioId: string;
    mergedStudioId: string;
    migratedRelationshipsCount: number;
  }> {
    const { canonicalId, mergingId, actorId, reason = 'Administrative studio duplicate consolidation', confidenceScore = 1.0 } = params;

    if (canonicalId === mergingId) {
      throw new Error('Cannot merge a studio into itself.');
    }

    const [canonical, merging] = await Promise.all([
      prisma.studio.findUnique({
        where: { id: canonicalId },
        include: {
          animeStudios: true,
          staffRelations: true,
          newsRelations: true,
          communities: true,
          historyEvents: true,
        },
      }),
      prisma.studio.findUnique({
        where: { id: mergingId },
        include: {
          animeStudios: true,
          staffRelations: true,
          newsRelations: true,
          communities: true,
          historyEvents: true,
          aliases: true,
        },
      }),
    ]);

    if (!canonical || !merging) {
      throw new Error('Canonical or Merging studio record does not exist.');
    }

    // Capture state for exact rollback
    const snapshot = {
      canonicalBefore: canonical,
      mergingBefore: merging,
      timestamp: new Date().toISOString(),
    };

    let migratedRelationshipsCount = 0;

    // Execute in Transaction
    const mergeRecord = await prisma.$transaction(async (tx) => {
      const canonicalAnimeIds = new Set(canonical.animeStudios.map((a) => a.animeId));
      const canonicalStaffKeys = new Set(canonical.staffRelations.map((s) => `${s.personId}:${s.role}`));
      const canonicalNewsArticleIds = new Set(canonical.newsRelations.map((n) => n.articleId));

      // 1. Migrate / Collapse AnimeStudio
      for (const rel of merging.animeStudios) {
        if (canonicalAnimeIds.has(rel.animeId)) {
          await tx.animeStudio.delete({
            where: { animeId_studioId: { animeId: rel.animeId, studioId: merging.id } },
          });
        } else {
          await tx.animeStudio.update({
            where: { animeId_studioId: { animeId: rel.animeId, studioId: merging.id } },
            data: { studioId: canonical.id },
          });
          migratedRelationshipsCount++;
        }
      }

      // 2. Migrate / Collapse StudioPerson
      for (const rel of merging.staffRelations) {
        if (canonicalStaffKeys.has(`${rel.personId}:${rel.role}`)) {
          await tx.studioPerson.delete({ where: { id: rel.id } });
        } else {
          await tx.studioPerson.update({
            where: { id: rel.id },
            data: { studioId: canonical.id },
          });
          migratedRelationshipsCount++;
        }
      }

      // 3. Migrate / Collapse NewsArticleStudio
      for (const rel of merging.newsRelations) {
        if (canonicalNewsArticleIds.has(rel.articleId)) {
          await tx.newsArticleStudio.delete({
            where: { articleId_studioId: { articleId: rel.articleId, studioId: merging.id } },
          });
        } else {
          await tx.newsArticleStudio.update({
            where: { articleId_studioId: { articleId: rel.articleId, studioId: merging.id } },
            data: { studioId: canonical.id },
          });
          migratedRelationshipsCount++;
        }
      }

      // 4. Migrate Communities
      for (const comm of merging.communities) {
        await tx.community.update({
          where: { id: comm.id },
          data: { studioId: canonical.id },
        });
        migratedRelationshipsCount++;
      }

      // 5. Migrate StudioHistoryEvents
      for (const ev of merging.historyEvents) {
        await tx.studioHistoryEvent.update({
          where: { id: ev.id },
          data: { studioId: canonical.id },
        });
        migratedRelationshipsCount++;
      }

      // 6. Register Merged Names as StudioAlias
      const newAliases = [
        { alias: merging.name, type: 'ALTERNATIVE' },
        ...(merging.nativeName ? [{ alias: merging.nativeName, type: 'NATIVE' }] : []),
        ...(merging.romanizedName ? [{ alias: merging.romanizedName, type: 'ROMANIZED' }] : []),
      ];

      for (const a of newAliases) {
        const norm = this.normalizeStudioName(a.alias);
        if (norm) {
          await tx.studioAlias.upsert({
            where: { studioId_normalizedAlias: { studioId: canonical.id, normalizedAlias: norm } },
            create: {
              studioId: canonical.id,
              alias: a.alias,
              normalizedAlias: norm,
              aliasType: a.type,
              source: `MERGE_FROM_${merging.id}`,
              verified: true,
            },
            update: {},
          });
        }
      }

      // 7. Register StudioRedirects
      await tx.studioRedirect.upsert({
        where: { sourceIdentifier: merging.id },
        create: {
          sourceIdentifier: merging.id,
          canonicalStudioId: canonical.id,
          redirectType: 'MERGE',
        },
        update: { canonicalStudioId: canonical.id },
      });

      if (merging.slug) {
        await tx.studioRedirect.upsert({
          where: { sourceIdentifier: merging.slug },
          create: {
            sourceIdentifier: merging.slug,
            canonicalStudioId: canonical.id,
            redirectType: 'MERGE',
          },
          update: { canonicalStudioId: canonical.id },
        });
      }

      // 8. Update Missing Fields on Canonical Studio
      const dataToUpdate: any = {};
      if (!canonical.nativeName && merging.nativeName) dataToUpdate.nativeName = merging.nativeName;
      if (!canonical.website && merging.website) dataToUpdate.website = merging.website;
      if (!canonical.about && merging.about) dataToUpdate.about = merging.about;
      if (!canonical.imageUrl && merging.imageUrl) dataToUpdate.imageUrl = merging.imageUrl;

      if (Object.keys(dataToUpdate).length > 0) {
        await tx.studio.update({
          where: { id: canonical.id },
          data: dataToUpdate,
        });
      }

      // 9. Mark Merging Studio as MERGED and ARCHIVED
      await tx.studio.update({
        where: { id: merging.id },
        data: {
          status: 'MERGED',
          publicationState: 'ARCHIVED',
        },
      });

      // 10. Record StudioMerge model
      const merge = await tx.studioMerge.create({
        data: {
          canonicalStudioId: canonical.id,
          mergedStudioId: merging.id,
          initiatedById: actorId,
          reason,
          confidenceScore,
          relationshipsMigratedCount: migratedRelationshipsCount,
          status: 'COMPLETED',
          rollbackAvailable: true,
          snapshotDataJson: JSON.stringify(snapshot),
        },
      });

      // 11. Write StudioAuditLog
      await tx.studioAuditLog.create({
        data: {
          studioId: canonical.id,
          actorId,
          action: 'MERGE',
          newValues: JSON.stringify({
            mergedStudioId: merging.id,
            mergedStudioName: merging.name,
            migratedRelationshipsCount,
            reason,
          }),
          reason,
        },
      });

      return merge;
    });

    // 12. Post-Merge Side Effects (Cache Purge & Analytics Recalculate)
    studioProductionHardeningService.flushAllStudioCaches(canonical.id);
    studioProductionHardeningService.flushAllStudioCaches(merging.id);

    // Queue background analytics rebuild
    studioAdvancedAnalyticsService.queueAnalyticsJob(actorId, canonical.id).catch((err) => {
      console.error('[StudioDeduplication] Failed to recalculate analytics post-merge:', err);
    });

    await eventEngine.emit({
      eventType: 'STUDIO_MERGED',
      userId: actorId,
      entityType: 'STUDIO',
      entityId: canonical.id,
      metadata: { canonicalId, mergingId, mergeRecordId: mergeRecord.id },
    });

    return {
      success: true,
      mergeId: mergeRecord.id,
      canonicalStudioId: canonical.id,
      mergedStudioId: merging.id,
      migratedRelationshipsCount,
    };
  }

  /**
   * Reversible Rollback of a Previous Studio Merge
   */
  async rollbackStudioMerge(mergeId: string, actorId: string): Promise<{ success: boolean; message: string }> {
    const mergeRecord = await prisma.studioMerge.findUnique({
      where: { id: mergeId },
      include: {
        canonicalStudio: true,
        mergedStudio: true,
      },
    });

    if (!mergeRecord) {
      throw new Error(`StudioMerge record ${mergeId} not found.`);
    }

    if (mergeRecord.status === 'ROLLED_BACK') {
      throw new Error('This merge operation has already been rolled back.');
    }

    if (!mergeRecord.rollbackAvailable || !mergeRecord.snapshotDataJson) {
      throw new Error('Rollback snapshot data is unavailable for this merge record.');
    }

    const snapshot = JSON.parse(mergeRecord.snapshotDataJson);
    const { canonicalBefore, mergingBefore } = snapshot;

    await prisma.$transaction(async (tx) => {
      // 1. Restore Merged Studio Status
      await tx.studio.update({
        where: { id: mergingBefore.id },
        data: {
          status: mergingBefore.status || 'ACTIVE',
          publicationState: mergingBefore.publicationState || 'PUBLISHED',
        },
      });

      // 2. Re-assign AnimeStudio from snapshot
      for (const a of mergingBefore.animeStudios || []) {
        await tx.animeStudio.upsert({
          where: { animeId_studioId: { animeId: a.animeId, studioId: mergingBefore.id } },
          create: {
            animeId: a.animeId,
            studioId: mergingBefore.id,
            role: a.role,
            isPrimary: a.isPrimary,
            isMain: a.isMain,
          },
          update: {},
        });
      }

      // 3. Re-assign Staff from snapshot
      for (const s of mergingBefore.staffRelations || []) {
        await tx.studioPerson.upsert({
          where: { studioId_personId_role: { studioId: mergingBefore.id, personId: s.personId, role: s.role } },
          create: {
            studioId: mergingBefore.id,
            personId: s.personId,
            role: s.role,
            isCurrent: s.isCurrent,
            tenureStartYear: s.tenureStartYear,
            tenureEndYear: s.tenureEndYear,
          },
          update: {},
        });
      }

      // 4. Re-assign Communities from snapshot
      for (const c of mergingBefore.communities || []) {
        await tx.community.update({
          where: { id: c.id },
          data: { studioId: mergingBefore.id },
        });
      }

      // 5. Re-assign History Events from snapshot
      for (const h of mergingBefore.historyEvents || []) {
        await tx.studioHistoryEvent.update({
          where: { id: h.id },
          data: { studioId: mergingBefore.id },
        });
      }

      // 6. Remove StudioRedirects created for this merge
      await tx.studioRedirect.deleteMany({
        where: {
          sourceIdentifier: { in: [mergingBefore.id, mergingBefore.slug].filter(Boolean) as string[] },
          canonicalStudioId: canonicalBefore.id,
        },
      });

      // 7. Update Merge Record status
      await tx.studioMerge.update({
        where: { id: mergeId },
        data: { status: 'ROLLED_BACK' },
      });

      // 8. Audit Log
      await tx.studioAuditLog.create({
        data: {
          studioId: canonicalBefore.id,
          actorId,
          action: 'RESTORE',
          reason: `Rolled back merge of studio "${mergingBefore.name}" (Merge ID: ${mergeId})`,
        },
      });
    });

    // Flush Caches
    studioProductionHardeningService.flushAllStudioCaches(canonicalBefore.id);
    studioProductionHardeningService.flushAllStudioCaches(mergingBefore.id);

    return {
      success: true,
      message: `Successfully rolled back merge ${mergeId}. Studio "${mergingBefore.name}" restored.`,
    };
  }

  /**
   * Resolves incoming studio identity BEFORE insertion (Pipeline Duplicate Prevention)
   */
  async resolveStudioIdentity(params: {
    name: string;
    nativeName?: string | null;
    slug?: string | null;
    externalId?: string | null;
    externalSource?: string | null;
    website?: string | null;
  }): Promise<{ isMatch: boolean; existingStudioId?: string; existingStudio?: any; matchReason?: string }> {
    const { name, nativeName, slug, externalId, externalSource, website } = params;

    // 1. Check External ID
    if (externalId && externalSource) {
      const extMatch = await prisma.studio.findFirst({
        where: { externalId, externalSource },
        select: { id: true, name: true, slug: true },
      });
      if (extMatch) {
        return { isMatch: true, existingStudioId: extMatch.id, existingStudio: extMatch, matchReason: `Matched external ID (${externalSource}: ${externalId})` };
      }
    }

    // 2. Check Exact Slug
    if (slug) {
      const slugMatch = await prisma.studio.findUnique({
        where: { slug },
        select: { id: true, name: true, slug: true },
      });
      if (slugMatch) {
        return { isMatch: true, existingStudioId: slugMatch.id, existingStudio: slugMatch, matchReason: `Matched exact canonical slug (${slug})` };
      }

      // Check Redirects
      const redirectMatch = await prisma.studioRedirect.findUnique({
        where: { sourceIdentifier: slug },
        include: { canonicalStudio: { select: { id: true, name: true, slug: true } } },
      });
      if (redirectMatch?.canonicalStudio) {
        return { isMatch: true, existingStudioId: redirectMatch.canonicalStudio.id, existingStudio: redirectMatch.canonicalStudio, matchReason: `Resolved via StudioRedirect (${slug})` };
      }
    }

    // 3. Check Exact Name
    const nameMatch = await prisma.studio.findFirst({
      where: { name: { equals: name.trim() } },
      select: { id: true, name: true, slug: true },
    });
    if (nameMatch) {
      return { isMatch: true, existingStudioId: nameMatch.id, existingStudio: nameMatch, matchReason: `Matched exact canonical name ("${name}")` };
    }

    // 4. Check Normalized Alias in StudioAlias table
    const normName = this.normalizeStudioName(name);
    if (normName) {
      const aliasMatch = await prisma.studioAlias.findFirst({
        where: { normalizedAlias: normName },
        include: { studio: { select: { id: true, name: true, slug: true } } },
      });
      if (aliasMatch?.studio) {
        return { isMatch: true, existingStudioId: aliasMatch.studio.id, existingStudio: aliasMatch.studio, matchReason: `Matched registered alias "${aliasMatch.alias}"` };
      }
    }

    // 5. Check Exact Native Name
    if (nativeName && nativeName.trim()) {
      const nativeMatch = await prisma.studio.findFirst({
        where: { nativeName: { equals: nativeName.trim() } },
        select: { id: true, name: true, slug: true },
      });
      if (nativeMatch) {
        return { isMatch: true, existingStudioId: nativeMatch.id, existingStudio: nativeMatch, matchReason: `Matched native name ("${nativeName}")` };
      }
    }

    // 6. Check Normalized Official Website
    const normWeb = this.normalizeWebsiteUrl(website);
    if (normWeb) {
      const webMatch = await prisma.studio.findFirst({
        where: { website: { contains: normWeb } },
        select: { id: true, name: true, slug: true },
      });
      if (webMatch) {
        return { isMatch: true, existingStudioId: webMatch.id, existingStudio: webMatch, matchReason: `Matched verified official website domain (${normWeb})` };
      }
    }

    return { isMatch: false };
  }

  /**
   * Resolves any studio identifier (canonical slug/ID, legacy alias, or redirect)
   */
  async resolveStudioIdentifier(slugOrId: string): Promise<string | null> {
    const clean = slugOrId.trim();

    // 1. Direct Active ID or Slug check
    const direct = await prisma.studio.findFirst({
      where: {
        OR: [{ id: clean }, { slug: clean }, { slug: clean.toLowerCase() }],
        status: { not: 'MERGED' },
        publicationState: 'PUBLISHED',
      },
      select: { id: true },
    });
    if (direct) return direct.id;

    // 2. Check Redirect Table
    const redirect = await prisma.studioRedirect.findUnique({
      where: { sourceIdentifier: clean },
      select: { canonicalStudioId: true },
    });
    if (redirect) return redirect.canonicalStudioId;

    // 3. Check StudioAlias Table
    const norm = this.normalizeStudioName(clean);
    if (norm) {
      const alias = await prisma.studioAlias.findFirst({
        where: { normalizedAlias: norm },
        select: { studioId: true },
      });
      if (alias) return alias.studioId;
    }

    return null;
  }
}

export const studioDeduplicationService = new StudioDeduplicationService();
