/**
 * Pure counting rules: no database access, so every rule is unit-testable.
 * The DB-facing orchestration lives in countingService.ts.
 */
import { BADGE_RULES, TIER_GATES } from './config';
import { TIERS, tierFor, tierIndex, getTier, type Tier, type TierKey } from './tiers';

// ---------------------------------------------------------------------------
// Submission eligibility
// ---------------------------------------------------------------------------

export function countWords(text: string): number {
  const t = (text ?? '').trim();
  if (!t) return 0;
  // Intl.Segmenter handles CJK (no spaces between words); fall back to whitespace.
  const Seg = (Intl as any).Segmenter;
  if (typeof Seg === 'function') {
    let n = 0;
    for (const s of new Seg(undefined, { granularity: 'word' }).segment(t)) if (s.isWordLike) n++;
    return n;
  }
  return t.split(/\s+/).filter(Boolean).length;
}

export type IneligibleReason = 'WRONG_REVIEW_TYPE' | 'NOT_WATCHED' | 'TOO_SHORT';

export interface SubmissionInput {
  body: string;
  reviewType: string;
  /** UserAnime.status at the time of writing, if any. */
  watchStatus: string | null | undefined;
}

export interface SubmissionResult {
  eligible: boolean;
  reason?: IneligibleReason;
  wordCount: number;
}

/**
 * Whether a freshly written review can ever count. Star-only ratings have no
 * body and never reach this; the rating value is deliberately ignored.
 */
export function evaluateSubmission(input: SubmissionInput): SubmissionResult {
  const wordCount = countWords(input.body);
  if (!BADGE_RULES.eligibleReviewTypes.includes(input.reviewType)) return { eligible: false, reason: 'WRONG_REVIEW_TYPE', wordCount };
  if (!input.watchStatus || !BADGE_RULES.eligibleWatchStatuses.includes(input.watchStatus)) return { eligible: false, reason: 'NOT_WATCHED', wordCount };
  if (wordCount < BADGE_RULES.minWords) return { eligible: false, reason: 'TOO_SHORT', wordCount };
  return { eligible: true, wordCount };
}

// ---------------------------------------------------------------------------
// Maturity + daily cap
// ---------------------------------------------------------------------------

export function isMature(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= BADGE_RULES.maturityHours * 3_600_000;
}

/** Start of the UTC day containing `d`. */
export function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** How many more reviews may become counted today, given how many already did. */
export function dailyCapRemaining(countedToday: number): number {
  return Math.max(0, BADGE_RULES.dailyCap - countedToday);
}

// ---------------------------------------------------------------------------
// Duplicate / spam detection
// ---------------------------------------------------------------------------

function normalizeWords(text: string): string[] {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(words: string[], n = 3): Set<string> {
  const out = new Set<string>();
  if (words.length < n) {
    if (words.length) out.add(words.join(' '));
    return out;
  }
  for (let i = 0; i <= words.length - n; i++) out.add(words.slice(i, i + n).join(' '));
  return out;
}

/** Jaccard similarity of word 3-shingles, 0..1. */
export function textSimilarity(a: string, b: string): number {
  const A = shingles(normalizeWords(a));
  const B = shingles(normalizeWords(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const s of A) if (B.has(s)) inter++;
  return inter / (A.size + B.size - inter);
}

export type SpamReason = 'DUPLICATE_TEXT' | 'TOO_MANY_LINKS' | 'LOW_VARIETY' | 'REPEATED_CHARACTERS';

/** Cheap "obviously spam" heuristics that need no other reviews to compare against. */
export function obviousSpamReason(body: string): SpamReason | null {
  const links = (body.match(/https?:\/\/|www\./gi) ?? []).length;
  if (links > BADGE_RULES.spam.maxLinks) return 'TOO_MANY_LINKS';
  if (new RegExp(`(.)\\1{${BADGE_RULES.spam.maxRepeatedCharRun},}`, 'u').test(body)) return 'REPEATED_CHARACTERS';
  const words = normalizeWords(body);
  if (words.length && new Set(words).size / words.length < BADGE_RULES.spam.minUniqueWordRatio) return 'LOW_VARIETY';
  return null;
}

/**
 * Run the automated check for one review against `others` (text of the same
 * user's other reviews, and earlier reviews of the same anime). Returns the
 * failure reason, or null when it passes.
 */
export function spamOrDuplicateReason(body: string, others: readonly string[]): SpamReason | null {
  const obvious = obviousSpamReason(body);
  if (obvious) return obvious;
  for (const other of others) {
    if (textSimilarity(body, other) >= BADGE_RULES.spam.nearDuplicateSimilarity) return 'DUPLICATE_TEXT';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tier resolution with quality gates
// ---------------------------------------------------------------------------

export interface TierInput {
  countedReviewCount: number;
  hasConfirmedSpam: boolean;
  helpfulVotes: number;
  lastCountedReviewAt: Date | null;
  /** The tier stored on the user before this recalculation. */
  previousTier: TierKey;
  now: Date;
}

function gatesFor(tier: Tier) {
  const i = tierIndex(tier);
  return TIER_GATES.filter((g) => g.enabled && tierIndex(g.fromTier) <= i);
}

/** Gates that must hold for a tier to be HELD (not the earn-time activity gate). */
function passesHoldGates(tier: Tier, input: TierInput): boolean {
  return gatesFor(tier).every((g) => {
    if (g.kind === 'cleanRecord') return !input.hasConfirmedSpam;
    if (g.kind === 'helpfulVotes') return input.helpfulVotes >= g.min;
    return true; // recentActivity is an earn-time gate only
  });
}

function passesEarnGates(tier: Tier, input: TierInput): boolean {
  if (!passesHoldGates(tier, input)) return false;
  return gatesFor(tier).every((g) => {
    if (g.kind !== 'recentActivity') return true;
    if (!input.lastCountedReviewAt) return false;
    return input.now.getTime() - input.lastCountedReviewAt.getTime() <= g.withinDays * 86_400_000;
  });
}

/**
 * The tier a user should hold now.
 *  - Earning a tier needs its count threshold and every enabled gate,
 *    including recent activity.
 *  - A tier already held is permanent as long as the count still justifies it
 *    and the standing gates (clean record, helpful floor) still pass; it is NOT
 *    lost for going quiet. Removing spam reviews can drop it.
 */
export function resolveTier(input: TierInput): Tier {
  const byCount = tierFor(input.countedReviewCount);
  let best = TIERS[0];
  for (const t of TIERS) {
    if (t.min > byCount.min) break;
    if (passesEarnGates(t, input)) best = t;
  }
  const prev = getTier(input.previousTier);
  if (tierIndex(prev) > tierIndex(best) && prev.min <= input.countedReviewCount && passesHoldGates(prev, input)) {
    return prev;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Critic's section eligibility
// ---------------------------------------------------------------------------

export interface CriticInput {
  tier: TierKey;
  hasConfirmedSpam: boolean;
  /** Counted reviews within BADGE_RULES.critics.recentActivityDays. */
  recentCountedReviews: number;
}

export function isCriticEligible(c: CriticInput): boolean {
  const cfg = BADGE_RULES.critics;
  if (tierIndex(c.tier) < tierIndex(cfg.minTier)) return false;
  if (cfg.requireCleanRecord && c.hasConfirmedSpam) return false;
  return c.recentCountedReviews >= cfg.minRecentReviews;
}
