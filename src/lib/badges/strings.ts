/**
 * Display strings for the badge system, kept out of components so they can
 * be swapped for a translation catalogue later. Tier names and thresholds
 * live in tiers.ts; only prose lives here.
 */

export const BADGE_STRINGS = {
  gloss: {
    shoshinsha: 'Beginner',
    kohai: 'Junior',
    senpai: 'Senior',
    buchou: 'Club captain',
    mekiki: 'Keen eye',
    sensei: 'Teacher',
    tatsujin: 'Expert',
    meijin: 'Grand master',
    densetsu: 'Legend',
  } as Record<string, string>,
  reviewerLabel: (name: string, count: number) =>
    `${name} reviewer, ${count.toLocaleString('en-US')} ${count === 1 ? 'point' : 'points'}`,
  reviewerLabelNoCount: (name: string) => `${name} reviewer`,
  tooltipRequires: (min: number) =>
    min === 0 ? 'Starting badge' : `${min.toLocaleString('en-US')} reviews & rated anime`,
  titleWithMeaning: (name: string, gloss: string) => `${name} · ${gloss}`,
  nextAt: (name: string, min: number) => `Next: ${name} at ${min.toLocaleString('en-US')} reviews & ratings`,
  toGo: (n: number) => `${n.toLocaleString('en-US')} to go`,
  topTier: 'Top tier reached',
  moreTo: (n: number, name: string) => `${n.toLocaleString('en-US')} more to ${name}`,
  locked: 'not yet earned',
  earned: 'earned',
  ladderTitle: 'Badges earned',
  unlockTitle: (name: string) => `New badge: ${name}`,
  unlockBody: (name: string, gloss: string) => `You are now a ${name} (${gloss}).`,
  milestone: (n: number) => `${n} reviews & ratings counted`,
  milestoneBody: (next: string, remaining: number) => `${remaining.toLocaleString('en-US')} more to ${next}.`,
  completedPrompt: 'You finished it. Write a review?',
  galleryTitle: 'Reviewer badges',
  galleryIntro:
    'Badges are earned by written reviews that pass our checks and by anime you rate episode by episode. They hint at experience; they do not certify a review as correct.',
} as const;

export function glossFor(key: string): string {
  return BADGE_STRINGS.gloss[key] ?? '';
}
