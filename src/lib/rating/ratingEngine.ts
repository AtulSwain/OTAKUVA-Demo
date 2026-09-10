/**
 * OTAKUVA Proprietary Rating & Statistical Calculation Engine
 * 
 * Implements pure, deterministic mathematical functions for:
 * - Bayesian Adjusted Score (OTAKUVA Score)
 * - Statistical Moments: Mean, Median, Variance, Standard Deviation
 * - 10-Bucket Integer Distribution (1.0 - 10.0)
 * - Category Averages & Normalized Percentage Shares (Hare-Niemeyer largest-remainder method totaling exactly 100%)
 * - Confidence Level Assessment
 */

export const RATING_ALGORITHM_VERSION = 1;

export const RATING_CATEGORIES = [
  'STORY',
  'CHARACTERS',
  'ANIMATION',
  'MUSIC',
  'PACING',
  'WORLD_BUILDING',
  'ENJOYMENT',
  'DIRECTION',
] as const;

export type RatingCategoryType = (typeof RATING_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<RatingCategoryType, string> = {
  STORY: 'Story',
  CHARACTERS: 'Characters',
  ANIMATION: 'Animation',
  MUSIC: 'Music',
  PACING: 'Pacing',
  WORLD_BUILDING: 'World Building',
  ENJOYMENT: 'Enjoyment',
  DIRECTION: 'Direction',
};

export type RatingConfidenceTier = 'NO_DATA' | 'EARLY' | 'LOW' | 'MEDIUM' | 'HIGH';

export const CATEGORY_EXPLANATION_TEXT =
  'Category percentages show the normalized share of community category ratings. They are provided for comparison and analysis and do not replace the OTAKUVA Score.';

export interface CategorySummaryItem {
  category: RatingCategoryType;
  label: string;
  averageScore: number;
  percentage: number;
  responseCount: number;
  confidence: RatingConfidenceTier;
}

export interface RatingSummaryResult {
  score: number | null; // OTAKUVA Bayesian Score
  ratingCount: number;
  rawAverage: number | null;
  median: number | null;
  variance: number | null;
  standardDeviation: number | null;
  confidence: RatingConfidenceTier;
  distribution: Record<number, { count: number; percentage: number }>;
  categories: CategorySummaryItem[];
  categoryPercentageTotal: number;
  algorithmVersion: number;
  explanatoryNote: string;
  updatedAt: string;
}

/**
 * Calculates raw arithmetic mean from an array of ratings
 */
export function calculateRawAverage(scores: number[]): number | null {
  if (!scores || scores.length === 0) return null;
  const validScores = scores.filter((s) => typeof s === 'number' && !isNaN(s) && s >= 0.5 && s <= 10.0);
  if (validScores.length === 0) return null;
  const sum = validScores.reduce((acc, val) => acc + val, 0);
  return parseFloat((sum / validScores.length).toFixed(2));
}

/**
 * Calculates statistical median value
 */
export function calculateMedian(scores: number[]): number | null {
  if (!scores || scores.length === 0) return null;
  const validScores = scores
    .filter((s) => typeof s === 'number' && !isNaN(s) && s >= 0.5 && s <= 10.0)
    .sort((a, b) => a - b);
  if (validScores.length === 0) return null;

  const mid = Math.floor(validScores.length / 2);
  if (validScores.length % 2 !== 0) {
    return parseFloat(validScores[mid].toFixed(1));
  }
  const medianVal = (validScores[mid - 1] + validScores[mid]) / 2;
  return parseFloat(medianVal.toFixed(1));
}

/**
 * Calculates sample variance
 */
export function calculateVariance(scores: number[], meanScore?: number | null): number | null {
  if (!scores || scores.length <= 1) return null;
  const validScores = scores.filter((s) => typeof s === 'number' && !isNaN(s) && s >= 0.5 && s <= 10.0);
  if (validScores.length <= 1) return null;

  const mean = typeof meanScore === 'number' ? meanScore : validScores.reduce((a, b) => a + b, 0) / validScores.length;
  const squareDiffs = validScores.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
  return parseFloat((squareDiffs / (validScores.length - 1)).toFixed(3));
}

/**
 * Calculates standard deviation
 */
export function calculateStandardDeviation(variance: number | null): number | null {
  if (variance === null || variance < 0) return null;
  return parseFloat(Math.sqrt(variance).toFixed(2));
}

/**
 * Classifies confidence based on statistical sample size
 */
export function calculateConfidence(count: number): RatingConfidenceTier {
  if (count <= 0) return 'NO_DATA';
  if (count < 10) return 'EARLY';
  if (count < 50) return 'LOW';
  if (count < 250) return 'MEDIUM';
  return 'HIGH';
}

/**
 * Calculates OTAKUVA Official Bayesian Adjusted Score:
 * S = (v / (v + m)) * R + (m / (v + m)) * C
 * 
 * @param rawAverage - Anime's community average (R)
 * @param ratingCount - Number of valid ratings (v)
 * @param globalAverage - Global OTAKUVA valid rating average (C)
 * @param minThreshold - Minimum confidence threshold (m), defaults to 25
 */
export function calculateBayesianScore(
  rawAverage: number | null,
  ratingCount: number,
  globalAverage = 7.5,
  minThreshold = 25
): number | null {
  if (rawAverage === null || ratingCount <= 0) return null;
  const v = ratingCount;
  const m = minThreshold;
  const R = rawAverage;
  const C = globalAverage;

  const adjusted = (v / (v + m)) * R + (m / (v + m)) * C;
  return parseFloat(adjusted.toFixed(2));
}

/**
 * Calculates 10-bucket rating distribution (1 to 10 integer scale)
 */
export function calculateDistribution(scores: number[]): Record<number, { count: number; percentage: number }> {
  const distribution: Record<number, { count: number; percentage: number }> = {
    1: { count: 0, percentage: 0 },
    2: { count: 0, percentage: 0 },
    3: { count: 0, percentage: 0 },
    4: { count: 0, percentage: 0 },
    5: { count: 0, percentage: 0 },
    6: { count: 0, percentage: 0 },
    7: { count: 0, percentage: 0 },
    8: { count: 0, percentage: 0 },
    9: { count: 0, percentage: 0 },
    10: { count: 0, percentage: 0 },
  };

  if (!scores || scores.length === 0) return distribution;

  const validScores = scores.filter((s) => typeof s === 'number' && !isNaN(s) && s >= 0.5 && s <= 10.0);
  const total = validScores.length;
  if (total === 0) return distribution;

  validScores.forEach((score) => {
    const bucket = Math.min(10, Math.max(1, Math.round(score)));
    distribution[bucket].count += 1;
  });

  for (let b = 1; b <= 10; b++) {
    distribution[b].percentage = parseFloat(((distribution[b].count / total) * 100).toFixed(1));
  }

  return distribution;
}

/**
 * Normalizes category averages into integer percentages that sum to strictly 100%
 * using the Hare-Niemeyer Largest Remainder Algorithm.
 * 
 * Formula:
 * category_percentage = (category_average / SUM(all category averages)) * 100
 */
export function calculateCategoryPercentages(
  categoryAverages: { category: RatingCategoryType; average: number }[]
): { category: RatingCategoryType; percentage: number }[] {
  if (!categoryAverages || categoryAverages.length === 0) return [];

  const totalAverage = categoryAverages.reduce((sum, item) => sum + item.average, 0);
  if (totalAverage <= 0) {
    // Equal distribution fallback if all averages are 0
    const equalShare = Math.floor(100 / categoryAverages.length);
    const remainder = 100 - equalShare * categoryAverages.length;
    return categoryAverages.map((item, idx) => ({
      category: item.category,
      percentage: equalShare + (idx < remainder ? 1 : 0),
    }));
  }

  // Calculate unrounded exact percentage shares and integer floors
  const shares = categoryAverages.map((item) => {
    const exact = (item.average / totalAverage) * 100;
    const floor = Math.floor(exact);
    const remainder = exact - floor;
    return {
      category: item.category,
      exact,
      floor,
      remainder,
    };
  });

  const sumFloors = shares.reduce((acc, s) => acc + s.floor, 0);
  const deficit = 100 - sumFloors;

  // Sort descending by largest remainder to distribute the remaining percentage points
  const sortedByRemainder = [...shares].sort((a, b) => b.remainder - a.remainder);

  const bonusCategories = new Set<RatingCategoryType>();
  for (let i = 0; i < deficit && i < sortedByRemainder.length; i++) {
    bonusCategories.add(sortedByRemainder[i].category);
  }

  return shares.map((s) => ({
    category: s.category,
    percentage: s.floor + (bonusCategories.has(s.category) ? 1 : 0),
  }));
}
