/**
 * What each reviewer level means and takes — the text behind the badge info
 * card (owner, 2026-10-27). Criteria are DERIVED from the real rules
 * (tiers.ts thresholds + config.ts gates), so they can't drift from what the
 * counting code actually checks. Prose only; colours stay in tiers.ts.
 */
import { BADGE_RULES, TIER_GATES } from './config';
import { TIERS, tierIndex, type Tier, type TierKey } from './tiers';

export const TIER_ABOUT: Record<TierKey, string> = {
  shoshinsha: 'Where every member starts. Rate episodes and write reviews to press your first stamp.',
  kohai: 'Your first stamp. You have started sharing what you watch, and people can see your take.',
  senpai: 'A seasoned voice. With a hundred reviews and ratings behind you, others look to you for a take worth reading.',
  buchou: 'Club captain. You lead the conversation on the shows you follow.',
  mekiki: 'A keen eye: someone who can tell a gem from a miss before the crowd does.',
  sensei: 'A teacher. Your reviews help other members decide what to watch next.',
  tatsujin: 'An expert with deep, wide experience across anime.',
  meijin: 'Grand master. Few reach this level, and it takes a long, clean record.',
  densetsu: 'Legend. The top of the ladder.',
};

export interface TierCriterion {
  /** Stable key, for React lists. */
  key: string;
  text: string;
  /** Whether the member already meets it, when that can be told from their count alone. */
  met?: boolean;
}

/** Everything a level needs, from the live rules. */
export function tierCriteria(tier: Tier, count?: number): TierCriterion[] {
  if (tier.min === 0) return [{ key: 'start', text: 'No requirements — everyone starts here.', met: true }];
  const out: TierCriterion[] = [
    {
      key: 'points',
      text: `Reach ${tier.min.toLocaleString('en-US')} points. Each counted review and each anime you rate episode by episode is 1 point.`,
      met: count === undefined ? undefined : count >= tier.min,
    },
    {
      key: 'reviews',
      text: `Reviews count after a short check: at least ${BADGE_RULES.minWords} words, on a show you've watched (ticked, rated or tracked), and not spam.`,
    },
  ];
  const at = tierIndex(tier);
  for (const g of TIER_GATES) {
    if (!g.enabled || tierIndex(g.fromTier) > at) continue;
    if (g.kind === 'cleanRecord' && !out.some((c) => c.key === 'clean')) {
      out.push({ key: 'clean', text: 'A clean record: no reviews removed as spam.' });
    } else if (g.kind === 'recentActivity') {
      out.push({ key: 'recent', text: `A review or rating in the last ${g.withinDays} days at the moment you reach it.` });
    } else if (g.kind === 'helpfulVotes') {
      out.push({ key: 'helpful', text: `${g.min} helpful votes on your reviews.` });
    }
  }
  return out;
}

/** What a level unlocks or means for the member. */
export function tierPerks(tier: Tier): string[] {
  const perks: string[] = [];
  if (tier.min > 0) perks.push('Its stamp on your profile and next to your reviews.');
  if (tierIndex(tier) >= tierIndex(BADGE_RULES.critics.minTier)) {
    perks.push("Eligible for the critic's section on anime pages (with a clean record and recent activity).");
  }
  if (tier.special) perks.push('A special lacquered seal.');
  if (tier.key === TIERS[TIERS.length - 1].key) perks.push('The highest level there is.');
  return perks;
}
