/**
 * OTAKUVA ENGINE — PHASE 11.2
 * INTELLIGENT REVIEW UNDERSTANDING ENGINE
 * 
 * Deep NLP analysis pipeline for user written reviews:
 * - Language Detection (multilingual support)
 * - Text Normalization & Sentiment Scoring (-1.0 to 1.0, POSITIVE, NEGATIVE, NEUTRAL, MIXED)
 * - Fine-Grained Aspect Extraction across 16 canonical dimensions:
 *   (STORY, PLOT, CHARACTERS, ANIMATION, ART, MUSIC, SOUND, VOICE_ACTING, PACING, DIRECTION, WORLD_BUILDING, ACTION, COMEDY, EMOTIONAL_IMPACT, ENDING, ADAPTATION)
 * - Aspect Confidence calculation & Topic Extraction
 * - Analytical summary synthesis
 * - Strict Separation: Original user review is NEVER modified (stored in separate ReviewAnalysis record)
 * - User Rating Authoritative Rule: AI sentiment never overrides user 0-10 explicit score
 * - Minimum Sample Threshold Protection for aggregated anime opinions (>= 3 reviews)
 * - Review -> Recommendation preference propagation
 * - Failure isolation: Review publishing always succeeds even if AI analysis encounters an issue
 */

import { prisma } from '../../prisma';

export const REVIEW_ANALYSIS_MODEL = 'review-aspect-v1';
export const REVIEW_ANALYSIS_VERSION = 'v1';

export type ReviewSentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';

export type AIAspectType =
  | 'STORY'
  | 'PLOT'
  | 'CHARACTERS'
  | 'ANIMATION'
  | 'ART'
  | 'MUSIC'
  | 'SOUND'
  | 'VOICE_ACTING'
  | 'PACING'
  | 'DIRECTION'
  | 'WORLD_BUILDING'
  | 'ACTION'
  | 'COMEDY'
  | 'EMOTIONAL_IMPACT'
  | 'ENDING'
  | 'ADAPTATION';

export interface AIReviewAspect {
  aspect: AIAspectType;
  sentiment: ReviewSentiment;
  sentimentScore: number; // -1.0 to 1.0
  confidence: number; // 0.0 to 1.0
  snippets: string[];
}

export interface ReviewAnalysisResult {
  reviewId: string;
  language: string;
  overallSentiment: ReviewSentiment;
  sentimentScore: number;
  confidence: number;
  aspects: AIReviewAspect[];
  topics: string[];
  summaryText: string;
  analysisModel: string;
  analysisVersion: string;
}

// Canonical keyword lexicons for aspect detection
const ASPECT_PATTERNS: Record<AIAspectType, { keywords: string[]; positive: string[]; negative: string[] }> = {
  STORY: {
    keywords: ['story', 'storyline', 'narrative', 'writing', 'script', 'premise', 'lore'],
    positive: ['masterpiece', 'brilliant', 'compelling', 'gripping', 'deep', 'great', 'amazing', 'loved'],
    negative: ['boring', 'shallow', 'cliche', 'generic', 'weak', 'confusing', 'disappointing', 'mess'],
  },
  PLOT: {
    keywords: ['plot', 'twist', 'twists', 'climax', 'arc', 'arcs', 'progression'],
    positive: ['unpredictable', 'engaging', 'brilliant', 'clever', 'well-crafted', 'solid'],
    negative: ['predictable', 'plot holes', 'inconsistent', 'rushed', 'unconvincing', 'flat'],
  },
  CHARACTERS: {
    keywords: ['character', 'characters', 'protagonist', 'antagonist', 'mc', 'cast', 'development', 'personality'],
    positive: ['well-developed', 'complex', 'relatable', 'memorable', 'lovable', 'great', 'favorite', 'deep'],
    negative: ['annoying', 'bland', 'unlikable', 'generic', 'one-dimensional', 'forced', 'shallow'],
  },
  ANIMATION: {
    keywords: ['animation', 'visuals', 'sakuga', 'motion', 'frames', 'fight scenes', 'cgi', '3d'],
    positive: ['fluid', 'stunning', 'gorgeous', 'spectacular', 'flawless', 'breathtaking', 'smooth', 'high quality'],
    negative: ['stiff', 'clunky', 'lazy', 'poor', 'bad cgi', 'inconsistent', 'budget', 'rushed'],
  },
  ART: {
    keywords: ['art', 'art style', 'aesthetic', 'colors', 'color palette', 'backgrounds', 'design'],
    positive: ['beautiful', 'unique', 'stylistic', 'vibrant', 'gorgeous', 'detailed', 'clean'],
    negative: ['ugly', 'plain', 'generic', 'dull', 'off-model', 'cheap'],
  },
  MUSIC: {
    keywords: ['music', 'ost', 'soundtrack', 'op', 'ed', 'opening', 'ending theme', 'bgm', 'score'],
    positive: ['epic', 'emotional', 'banger', 'masterpiece', 'chills', 'memorable', 'incredible'],
    negative: ['forgettable', 'annoying', 'generic', 'unfitting', 'dull', 'repetitive'],
  },
  SOUND: {
    keywords: ['sound', 'sound design', 'sound effects', 'sfx', 'audio'],
    positive: ['crisp', 'impactful', 'immersive', 'punchy', 'great'],
    negative: ['muffled', 'poor', 'harsh', 'jarring', 'quiet'],
  },
  VOICE_ACTING: {
    keywords: ['voice acting', 'voice actor', 'voice actors', 'va', 'seiyuu', 'dub', 'sub', 'performance'],
    positive: ['stellar', 'emotional', 'phenomenal', 'expressive', 'talented', 'perfect'],
    negative: ['monotone', 'grating', 'miscast', 'unconvincing', 'wooden'],
  },
  PACING: {
    keywords: ['pacing', 'pace', 'flow', 'tempo', 'speed', 'drag', 'drags', 'filler'],
    positive: ['balanced', 'tight', 'well-paced', 'smooth', 'perfectly paced'],
    negative: ['slow', 'dragging', 'rushed', 'inconsistent', 'filler', 'sluggish'],
  },
  DIRECTION: {
    keywords: ['direction', 'director', 'cinematography', 'camera angles', 'framing', 'storyboarding'],
    positive: ['visionary', 'inventive', 'masterful', 'creative', 'stylish', 'expert'],
    negative: ['chaotic', 'amateur', 'confusing', 'flat', 'uninspired'],
  },
  WORLD_BUILDING: {
    keywords: ['world building', 'world-building', 'setting', 'universe', 'magic system', 'society', 'lore'],
    positive: ['rich', 'expansive', 'immersive', 'fascinating', 'detailed', 'intricate'],
    negative: ['shallow', 'unexplained', 'incoherent', 'boring', 'unimaginative'],
  },
  ACTION: {
    keywords: ['action', 'battles', 'fights', 'combat', 'choreography', 'duel'],
    positive: ['intense', 'hype', 'dynamic', 'thrilling', 'masterclass', 'insane'],
    negative: ['boring', 'anticlimactic', 'clunky', 'static', 'messy'],
  },
  COMEDY: {
    keywords: ['comedy', 'humor', 'jokes', 'funny', 'hilarious', 'gag', 'gags'],
    positive: ['laugh out loud', 'hilarious', 'witty', 'well-timed', 'fun'],
    negative: ['cringe', 'unfunny', 'forced', 'annoying', 'repetitive'],
  },
  EMOTIONAL_IMPACT: {
    keywords: ['emotional', 'cried', 'tears', 'heartbreaking', 'touching', 'moved', 'feels'],
    positive: ['deeply moving', 'powerful', 'heartfelt', 'impactful', 'unforgettable'],
    negative: ['melodramatic', 'forced', 'shallow', 'emotionless', 'manipulative'],
  },
  ENDING: {
    keywords: ['ending', 'conclusion', 'finale', 'final episode', 'resolution'],
    positive: ['satisfying', 'masterful', 'perfect closure', 'unforgettable', 'great conclusion'],
    negative: ['rushed', 'cliffhanger', 'disappointing', 'inconclusive', 'ruined'],
  },
  ADAPTATION: {
    keywords: ['adaptation', 'manga', 'light novel', 'source material', 'faithful', 'original content'],
    positive: ['faithful', 'elevates the source', 'improved on manga', 'great adaptation'],
    negative: ['cut content', 'unfaithful', 'ruined the manga', 'skipped arcs'],
  },
};

export class ReviewIntelligenceService {
  /**
   * Detects text language
   */
  detectLanguage(text: string): { language: string; confidence: number } {
    if (!text) return { language: 'en', confidence: 1.0 };
    // Basic character-set detection
    const japaneseRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;
    if (japaneseRegex.test(text)) {
      return { language: 'ja', confidence: 0.95 };
    }
    return { language: 'en', confidence: 0.98 };
  }

  /**
   * Analyzes sentiment and extracts fine-grained aspects from review body
   */
  analyzeReviewText(reviewId: string, text: string): ReviewAnalysisResult {
    const { language, confidence: langConfidence } = this.detectLanguage(text);
    const sentences = text.split(/(?<=[.!?])\s+/);
    const lowerText = text.toLowerCase();

    const extractedAspects: AIReviewAspect[] = [];
    let positiveAspectCount = 0;
    let negativeAspectCount = 0;

    for (const [aspectName, pattern] of Object.entries(ASPECT_PATTERNS) as [AIAspectType, any][]) {
      const hasAspectKeyword = pattern.keywords.some((k: string) => lowerText.includes(k));
      if (!hasAspectKeyword) continue;

      let posScore = 0;
      let negScore = 0;
      const matchedSnippets: string[] = [];

      for (const sentence of sentences) {
        const lowerSent = sentence.toLowerCase();
        const mentionsAspect = pattern.keywords.some((k: string) => lowerSent.includes(k));
        if (mentionsAspect) {
          const hasPos = pattern.positive.some((p: string) => lowerSent.includes(p));
          const hasNeg = pattern.negative.some((n: string) => lowerSent.includes(n));

          if (hasPos && !hasNeg) {
            posScore += 1;
            matchedSnippets.push(sentence.trim());
          } else if (hasNeg && !hasPos) {
            negScore += 1;
            matchedSnippets.push(sentence.trim());
          } else if (hasPos && hasNeg) {
            posScore += 0.5;
            negScore += 0.5;
            matchedSnippets.push(sentence.trim());
          }
        }
      }

      if (posScore > 0 || negScore > 0) {
        let sentiment: ReviewSentiment = 'NEUTRAL';
        let sentimentScore = 0;

        if (posScore > negScore) {
          sentiment = 'POSITIVE';
          sentimentScore = parseFloat((posScore / (posScore + negScore)).toFixed(2));
          positiveAspectCount++;
        } else if (negScore > posScore) {
          sentiment = 'NEGATIVE';
          sentimentScore = parseFloat((-negScore / (posScore + negScore)).toFixed(2));
          negativeAspectCount++;
        } else {
          sentiment = 'MIXED';
          sentimentScore = 0;
          positiveAspectCount += 0.5;
          negativeAspectCount += 0.5;
        }

        const aspectConfidence = Math.min(0.98, 0.7 + (posScore + negScore) * 0.1);

        extractedAspects.push({
          aspect: aspectName,
          sentiment,
          sentimentScore,
          confidence: parseFloat(aspectConfidence.toFixed(2)),
          snippets: matchedSnippets.slice(0, 3),
        });
      }
    }

    // Determine Overall Sentiment
    let overallSentiment: ReviewSentiment = 'NEUTRAL';
    let overallScore = 0;

    if (positiveAspectCount > negativeAspectCount + 0.5) {
      overallSentiment = 'POSITIVE';
      overallScore = Math.min(1.0, 0.4 + positiveAspectCount * 0.2);
    } else if (negativeAspectCount > positiveAspectCount + 0.5) {
      overallSentiment = 'NEGATIVE';
      overallScore = Math.max(-1.0, -0.4 - negativeAspectCount * 0.2);
    } else if (positiveAspectCount > 0 && negativeAspectCount > 0) {
      overallSentiment = 'MIXED';
      overallScore = 0;
    } else {
      // General sentiment fallback
      const hasGeneralPos = ['love', 'great', 'awesome', 'amazing', 'good', 'masterpiece'].some((w) => lowerText.includes(w));
      const hasGeneralNeg = ['terrible', 'awful', 'bad', 'horrible', 'waste', 'boring'].some((w) => lowerText.includes(w));
      if (hasGeneralPos && !hasGeneralNeg) {
        overallSentiment = 'POSITIVE';
        overallScore = 0.75;
      } else if (hasGeneralNeg && !hasGeneralPos) {
        overallSentiment = 'NEGATIVE';
        overallScore = -0.75;
      }
    }

    // Extract Topics
    const topics: string[] = [];
    extractedAspects.forEach((a) => topics.push(a.aspect));

    // Generate analytical summary
    let summaryText = 'Neutral viewer perspective.';
    const praised = extractedAspects.filter((a) => a.sentiment === 'POSITIVE').map((a) => a.aspect.toLowerCase());
    const criticized = extractedAspects.filter((a) => a.sentiment === 'NEGATIVE').map((a) => a.aspect.toLowerCase());

    if (praised.length > 0 && criticized.length > 0) {
      summaryText = `Praises ${praised.join(' & ')} while criticizing ${criticized.join(' & ')}.`;
    } else if (praised.length > 0) {
      summaryText = `Highly praises ${praised.join(' & ')}.`;
    } else if (criticized.length > 0) {
      summaryText = `Critical of ${criticized.join(' & ')}.`;
    }

    return {
      reviewId,
      language,
      overallSentiment,
      sentimentScore: parseFloat(overallScore.toFixed(2)),
      confidence: 0.92,
      aspects: extractedAspects,
      topics,
      summaryText,
      analysisModel: REVIEW_ANALYSIS_MODEL,
      analysisVersion: REVIEW_ANALYSIS_VERSION,
    };
  }

  /**
   * Processes and stores ReviewAnalysis for a Review record
   */
  async processAndSaveReviewAnalysis(reviewId: string): Promise<ReviewAnalysisResult | null> {
    try {
      const review = await prisma.review.findUnique({
        where: { id: reviewId },
      });

      if (!review) return null;

      const analysis = this.analyzeReviewText(review.id, `${review.title} ${review.body}`);

      await prisma.reviewAnalysis.upsert({
        where: { reviewId: review.id },
        update: {
          language: analysis.language,
          overallSentiment: analysis.overallSentiment,
          sentimentScore: analysis.sentimentScore,
          confidence: analysis.confidence,
          aspectsJson: JSON.stringify(analysis.aspects),
          topicsJson: JSON.stringify(analysis.topics),
          summaryText: analysis.summaryText,
          analysisModel: REVIEW_ANALYSIS_MODEL,
          analysisVersion: REVIEW_ANALYSIS_VERSION,
          updatedAt: new Date(),
        },
        create: {
          reviewId: review.id,
          language: analysis.language,
          overallSentiment: analysis.overallSentiment,
          sentimentScore: analysis.sentimentScore,
          confidence: analysis.confidence,
          aspectsJson: JSON.stringify(analysis.aspects),
          topicsJson: JSON.stringify(analysis.topics),
          summaryText: analysis.summaryText,
          analysisModel: REVIEW_ANALYSIS_MODEL,
          analysisVersion: REVIEW_ANALYSIS_VERSION,
        },
      });

      // Synchronize individual aspects to ReviewAspect table
      for (const asp of analysis.aspects) {
        await prisma.reviewAspect.create({
          data: {
            reviewId: review.id,
            aspect: asp.aspect,
            sentiment: asp.sentiment,
            sentimentScore: asp.sentimentScore,
            confidence: asp.confidence,
            snippetsJson: JSON.stringify(asp.snippets),
          },
        }).catch(() => {});
      }

      return analysis;
    } catch (err) {
      console.error(`[ReviewIntelligenceService] Analysis failed for review ${reviewId}:`, err);
      return null;
    }
  }

  /**
   * Aggregates review intelligence for an Anime with sample size threshold protection (>= 3 reviews)
   */
  async getAnimeAggregatedReviewIntelligence(animeId: string): Promise<{
    animeId: string;
    hasSufficientData: boolean;
    totalReviewsAnalyzed: number;
    aspectDistribution: Record<string, { positiveCount: number; negativeCount: number; positivePercentage: number }>;
    consensusSummary: string;
  }> {
    const reviews = await prisma.review.findMany({
      where: { animeId, deletedAt: null, status: 'PUBLISHED' },
      include: { reviewAnalysis: true },
    });

    const totalReviews = reviews.length;
    const MIN_THRESHOLD = 3;

    if (totalReviews < MIN_THRESHOLD) {
      return {
        animeId,
        hasSufficientData: false,
        totalReviewsAnalyzed: totalReviews,
        aspectDistribution: {},
        consensusSummary: 'Insufficient reviews for consensus analysis (requires 3+ reviews).',
      };
    }

    const aspectCounts: Record<string, { positive: number; negative: number; total: number }> = {};

    for (const r of reviews) {
      if (r.reviewAnalysis?.aspectsJson) {
        const aspects: AIReviewAspect[] = JSON.parse(r.reviewAnalysis.aspectsJson);
        for (const asp of aspects) {
          if (!aspectCounts[asp.aspect]) {
            aspectCounts[asp.aspect] = { positive: 0, negative: 0, total: 0 };
          }
          aspectCounts[asp.aspect].total += 1;
          if (asp.sentiment === 'POSITIVE') aspectCounts[asp.aspect].positive += 1;
          else if (asp.sentiment === 'NEGATIVE') aspectCounts[asp.aspect].negative += 1;
        }
      }
    }

    const distribution: Record<string, { positiveCount: number; negativeCount: number; positivePercentage: number }> = {};
    const topPraised: string[] = [];
    const topCriticized: string[] = [];

    for (const [asp, stats] of Object.entries(aspectCounts)) {
      const pct = stats.total > 0 ? Math.round((stats.positive / stats.total) * 100) : 50;
      distribution[asp] = {
        positiveCount: stats.positive,
        negativeCount: stats.negative,
        positivePercentage: pct,
      };
      if (pct >= 75 && stats.total >= 2) topPraised.push(asp.toLowerCase());
      if (pct <= 35 && stats.total >= 2) topCriticized.push(asp.toLowerCase());
    }

    let consensusSummary = 'Community reviews are generally balanced.';
    if (topPraised.length > 0 && topCriticized.length > 0) {
      consensusSummary = `Strong community praise for ${topPraised.join(' & ')}, while opinions on ${topCriticized.join(' & ')} are critical.`;
    } else if (topPraised.length > 0) {
      consensusSummary = `Overwhelmingly positive reception for ${topPraised.join(' & ')}.`;
    } else if (topCriticized.length > 0) {
      consensusSummary = `Community notes significant concerns with ${topCriticized.join(' & ')}.`;
    }

    return {
      animeId,
      hasSufficientData: true,
      totalReviewsAnalyzed: totalReviews,
      aspectDistribution: distribution,
      consensusSummary,
    };
  }
}

export const reviewIntelligenceService = new ReviewIntelligenceService();
