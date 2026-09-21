/**
 * Review ordering that respects badges without being ruled by them.
 *
 * Score = (helpful votes + 1) x time decay x (1 + small, capped tier boost).
 * Tier can add at most `tierBoostCap` (10% by default), so a reviewer's badge
 * nudges visibility but can never outrank a clearly more helpful review. In
 * the critic's section, tier is only a tiebreaker (no multiplicative boost).
 */
import { BADGE_RULES } from './config';
import { tierIndex, type TierKey } from './tiers';

export interface ScoreInput {
  helpfulVotes: number;
  createdAt: Date;
  tier: TierKey;
  now?: Date;
}

export function timeDecay(createdAt: Date, now: Date = new Date()): number {
  const ageDays = Math.max(0, (now.getTime() - createdAt.getTime()) / 86_400_000);
  return Math.pow(0.5, ageDays / BADGE_RULES.ranking.halfLifeDays);
}

/** Capped multiplicative boost for the general review feed. */
export function tierBoost(tier: TierKey): number {
  const { tierBoostPerStep, tierBoostCap } = BADGE_RULES.ranking;
  return 1 + Math.min(tierBoostCap, tierBoostPerStep * tierIndex(tier));
}

export function helpfulnessScore(input: ScoreInput): number {
  return (Math.max(0, input.helpfulVotes) + 1) * timeDecay(input.createdAt, input.now);
}

/** Feed ranking: helpfulness x recency x capped tier boost. */
export function feedScore(input: ScoreInput): number {
  return helpfulnessScore(input) * tierBoost(input.tier);
}

/** Critic ranking: helpfulness x recency; tier is only a tiebreaker (see compareCritic). */
export const criticScore = helpfulnessScore;

const EPSILON = 1e-9;

export function compareCritic(a: ScoreInput, b: ScoreInput): number {
  const d = criticScore(b) - criticScore(a);
  if (Math.abs(d) > EPSILON) return d;
  return tierIndex(b.tier) - tierIndex(a.tier);
}

/** Reviewers eligible for the "rising" slot: newer or lower-tier, so they are not buried. */
export function isRisingCandidate(tier: TierKey, createdAt: Date, now: Date = new Date()): boolean {
  const { risingMaxTier, risingMaxAgeDays } = BADGE_RULES.ranking;
  const young = now.getTime() - createdAt.getTime() <= risingMaxAgeDays * 86_400_000;
  return young && tierIndex(tier) <= tierIndex(risingMaxTier);
}
