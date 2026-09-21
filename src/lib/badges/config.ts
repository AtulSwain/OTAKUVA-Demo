/**
 * Every tunable number behind reviewer-badge counting. Tier thresholds and
 * colours live in tiers.ts; everything about *which reviews count* and *what
 * else a tier needs* lives here so it can be tuned without touching logic.
 */
import type { TierKey } from './tiers';

export const BADGE_RULES = {
  /** A review qualifies only if its written body is at least this many words. */
  minWords: 40,
  /** Pending -> counted only after this long, and only if the checks pass. */
  maturityHours: 48,
  /** At most this many of one user's reviews can become counted per UTC day. */
  dailyCap: 5,
  /**
   * The user must have the title in one of these states (UserAnime.status) when
   * writing. Watching can't be verified on a non-streaming site, so this is a
   * friction gate, not proof. PLAN_TO_WATCH is deliberately excluded.
   */
  eligibleWatchStatuses: ['WATCHING', 'COMPLETED', 'ON_HOLD', 'DROPPED'] as readonly string[],
  /** Only whole-anime reviews count; episode and season reviews never do. */
  eligibleReviewTypes: ['ANIME_REVIEW'] as readonly string[],

  spam: {
    /** Jaccard similarity of word 3-shingles at/above which text is a near-duplicate. */
    nearDuplicateSimilarity: 0.8,
    /** More links than this in one review is treated as obvious spam. */
    maxLinks: 2,
    /** Distinct words / total words below this is treated as filler/keyboard-mash. */
    minUniqueWordRatio: 0.3,
    /** A single character repeated this many times in a row is spam. */
    maxRepeatedCharRun: 12,
    /** How many of the user's own recent reviews to compare against. */
    ownLookback: 200,
    /** How many other-user reviews of the same anime (created earlier) to compare against. */
    sameAnimeLookback: 300,
  },

  /** Progress moments only, not badges. Between Kōhai (10) and Senpai (100). */
  milestones: [25, 50, 75] as readonly number[],

  critics: {
    /** Raise this later to tighten the critic's section. */
    minTier: 'senpai' as TierKey,
    requireCleanRecord: true,
    /** Needs at least `minRecentReviews` counted reviews within this many days. */
    recentActivityDays: 90,
    minRecentReviews: 1,
  },

  ranking: {
    /** Helpfulness half-life for the time-decayed critic score. */
    halfLifeDays: 45,
    /** Tier is a weak tiebreaker / capped boost: score * (1 + min(cap, step * tierIndex)). */
    tierBoostPerStep: 0.02,
    tierBoostCap: 0.1,
    /** "Rising reviews": reviewers at or below this tier, newer than this many days. */
    risingMaxTier: 'buchou' as TierKey,
    risingMaxAgeDays: 30,
  },

  job: {
    /** How often the recurring maturation job ticks. */
    intervalMinutes: 15,
    /** Max reviews examined per tick. */
    batchSize: 500,
  },
} as const;

/**
 * Quality qualifiers per tier. A gate applies to `fromTier` and every tier
 * above it. `enabled: false` ships the rule off (kept so it can be flipped on
 * later without code changes).
 */
export type TierGate =
  | { kind: 'cleanRecord'; fromTier: TierKey; enabled: boolean }
  /** Total helpful votes on the user's reviews. Off at launch: no vote data yet. */
  | { kind: 'helpfulVotes'; fromTier: TierKey; enabled: boolean; min: number }
  /**
   * A counted review within `withinDays`. Checked only at the moment a tier
   * is EARNED, not to keep it (earned tiers are permanent).
   */
  | { kind: 'recentActivity'; fromTier: TierKey; enabled: boolean; withinDays: number };

export const TIER_GATES: readonly TierGate[] = [
  { kind: 'cleanRecord', fromTier: 'senpai', enabled: true },
  { kind: 'helpfulVotes', fromTier: 'sensei', enabled: false, min: 25 },
  { kind: 'cleanRecord', fromTier: 'meijin', enabled: true },
  { kind: 'recentActivity', fromTier: 'meijin', enabled: true, withinDays: 90 },
];
