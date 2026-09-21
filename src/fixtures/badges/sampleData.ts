/**
 * PLACEHOLDER DATA: development, stories and demo pages only.
 *
 * Everything here is fictional (usernames, the anime, the communities, all
 * counts). It must never reach a production build or database:
 *  - the /badges/lab page that renders it calls notFound() in production;
 *  - scripts/badges/seed_sample.ts refuses to run when NODE_ENV=production and
 *    tags every row it creates so scripts/badges/seed_sample.ts --remove can
 *    delete exactly those rows.
 *
 * Markers on seeded rows: user email domain, anime externalSource, community
 * slug prefix (see PLACEHOLDER below).
 */
import type { TierKey } from '../../lib/badges/tiers';

export const PLACEHOLDER = {
  emailDomain: 'placeholder.invalid',
  animeSource: 'placeholder-seed',
  slugPrefix: 'placeholder-',
} as const;

export interface SampleUser {
  username: string;
  tier: TierKey;
  reviews: number;
  helpfulVotes: number;
}

export const SAMPLE_USERS: Record<string, SampleUser> = {
  yuki_watches: { username: 'yuki_watches', tier: 'sensei', reviews: 532, helpfulVotes: 1800 },
  kaito_reviews: { username: 'kaito_reviews', tier: 'meijin', reviews: 1043, helpfulVotes: 4210 },
  'sora.nights': { username: 'sora.nights', tier: 'sensei', reviews: 618, helpfulVotes: 1320 },
  mika_reviews: { username: 'mika_reviews', tier: 'mekiki', reviews: 342, helpfulVotes: 690 },
  taro_k: { username: 'taro_k', tier: 'meijin', reviews: 1043, helpfulVotes: 3900 },
  'rin.mecha': { username: 'rin.mecha', tier: 'mekiki', reviews: 342, helpfulVotes: 505 },
  hikari_9: { username: 'hikari_9', tier: 'kohai', reviews: 14, helpfulVotes: 6 },
  // Owners of the two communities yuki_watches only belongs to.
  placeholder_owner_a: { username: 'placeholder_owner_a', tier: 'senpai', reviews: 120, helpfulVotes: 80 },
  placeholder_owner_b: { username: 'placeholder_owner_b', tier: 'kohai', reviews: 30, helpfulVotes: 12 },
};

export const SAMPLE_ANIME = {
  slug: `${PLACEHOLDER.slugPrefix}sunrise-over-kyoto`,
  title: 'Sunrise Over Kyoto',
  totalReviews: 1248,
  byTier: { kohai: 512, senpai: 348, buchou: 152, mekiki: 108, sensei: 70, tatsujin: 38, meijin: 16, densetsu: 4 } as Record<string, number>,
  topReviewers: [
    { username: 'kaito_reviews', snippet: 'A quiet, patient series that trusts its images. The final act reframes every early sunrise, and it earns that without a single line of narration.' },
    { username: 'sora.nights', snippet: 'Kyoto is a character here. The sound design does more for the mood than the dialogue, and the pacing rewards a slow watch.' },
    { username: 'mika_reviews', snippet: 'Gentle and specific. The side cast gets real scenes, which is rare, and the ending lands because of them.' },
  ],
};

export interface SampleCommunity {
  slug: string;
  name: string;
  memberCount: number;
  founder: string;
  /** How the featured user (yuki_watches) relates to it. */
  yukiRole: 'FOUNDER' | 'MEMBER';
  byTier?: Record<string, number>;
}

export const SAMPLE_COMMUNITIES: SampleCommunity[] = [
  {
    slug: `${PLACEHOLDER.slugPrefix}mecha-mondays`,
    name: 'Mecha Mondays',
    memberCount: 2140,
    founder: 'yuki_watches',
    yukiRole: 'FOUNDER',
    byTier: { kohai: 1180, senpai: 520, buchou: 190, mekiki: 130, sensei: 80, tatsujin: 25, meijin: 12, densetsu: 3 },
  },
  { slug: `${PLACEHOLDER.slugPrefix}slice-of-life-society`, name: 'Slice of Life Society', memberCount: 386, founder: 'yuki_watches', yukiRole: 'FOUNDER' },
  { slug: `${PLACEHOLDER.slugPrefix}isekai-fatigue-support-group`, name: 'Isekai Fatigue Support Group', memberCount: 5912, founder: 'placeholder_owner_a', yukiRole: 'MEMBER' },
  { slug: `${PLACEHOLDER.slugPrefix}seasonal-watchers`, name: 'Seasonal Watchers', memberCount: 12400, founder: 'placeholder_owner_b', yukiRole: 'MEMBER' },
];

/** Mecha Mondays members list, highest badge first. */
export const SAMPLE_MECHA_MEMBERS = [
  { username: 'taro_k', role: 'MODERATOR' as const },
  { username: 'yuki_watches', role: 'FOUNDER' as const },
  { username: 'rin.mecha', role: 'MEMBER' as const },
  { username: 'hikari_9', role: 'MEMBER' as const },
];
