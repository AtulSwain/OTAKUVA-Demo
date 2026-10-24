/**
 * The fixed vocabulary reviewers pick from ("community tags"). The single
 * source of truth: the review API validates against it, the composer
 * renders it, the anime page labels counts with it. No free text, so
 * nothing needs moderating; changing a label is safe, but a key is stored
 * in ReviewTag.tag and must never be renamed or reused.
 */

export interface ReviewTagDef {
  key: string;
  label: string;
  group: 'Feel' | 'Story' | 'Craft' | 'Heads-up';
}

export const REVIEW_TAGS: readonly ReviewTagDef[] = [
  // How it feels to watch
  { key: 'comfy', label: 'Comfy', group: 'Feel' },
  { key: 'wholesome', label: 'Wholesome', group: 'Feel' },
  { key: 'hype', label: 'Hype', group: 'Feel' },
  { key: 'emotional', label: 'Emotional', group: 'Feel' },
  { key: 'tearjerker', label: 'Tearjerker', group: 'Feel' },
  { key: 'funny', label: 'Funny', group: 'Feel' },
  { key: 'dark', label: 'Dark', group: 'Feel' },
  { key: 'thought-provoking', label: 'Thought-provoking', group: 'Feel' },
  // Story & characters
  { key: 'slow-burn', label: 'Slow burn', group: 'Story' },
  { key: 'fast-paced', label: 'Fast-paced', group: 'Story' },
  { key: 'plot-twists', label: 'Plot twists', group: 'Story' },
  { key: 'great-characters', label: 'Great characters', group: 'Story' },
  { key: 'strong-ending', label: 'Strong ending', group: 'Story' },
  { key: 'worldbuilding', label: 'Worldbuilding', group: 'Story' },
  { key: 'romance', label: 'Romance done right', group: 'Story' },
  // Craft
  { key: 'stunning-animation', label: 'Stunning animation', group: 'Craft' },
  { key: 'great-fights', label: 'Great fights', group: 'Craft' },
  { key: 'great-ost', label: 'Great OST', group: 'Craft' },
  { key: 'great-voice-acting', label: 'Great voice acting', group: 'Craft' },
  // Heads-up for other viewers
  { key: 'bingeable', label: 'Bingeable', group: 'Heads-up' },
  { key: 'beginner-friendly', label: 'Beginner-friendly', group: 'Heads-up' },
  { key: 'gets-better', label: 'Gets better later', group: 'Heads-up' },
  { key: 'weak-ending', label: 'Weak ending', group: 'Heads-up' },
  { key: 'filler-heavy', label: 'Filler-heavy', group: 'Heads-up' },
] as const;

/** Most tags one review may carry. */
export const MAX_REVIEW_TAGS = 5;

const BY_KEY = new Map(REVIEW_TAGS.map((t) => [t.key, t]));

export function isReviewTagKey(value: unknown): value is string {
  return typeof value === 'string' && BY_KEY.has(value);
}

export function reviewTagLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? key;
}

/**
 * Validate client input: known keys only, de-duplicated, capped. Returns
 * null when the input isn't an array (field absent → leave tags unchanged).
 */
export function sanitizeReviewTags(input: unknown): string[] | null {
  if (input === undefined) return null;
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.filter(isReviewTagKey))).slice(0, MAX_REVIEW_TAGS);
}
