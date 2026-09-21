import { getTier, type Tier, type TierKey } from '../../lib/badges/tiers';
import { BADGE_STRINGS } from '../../lib/badges/strings';
import { tierVars } from './tierStyle';
import styles from './BadgeChip.module.css';

export interface BadgeChipProps {
  tier: TierKey | Tier;
  /** Reviewer's counted total; folded into the accessible label when given. */
  count?: number;
  /** Render as a locked (not yet earned) outline regardless of tier. */
  locked?: boolean;
  className?: string;
}

/**
 * Small pill with the romaji name. Never uses kanji: at 11px it is
 * unreadable, and Senpai (先輩) / Sensei (先生) share the character 先.
 */
export default function BadgeChip({ tier, count, locked, className }: BadgeChipProps) {
  const t = typeof tier === 'string' ? getTier(tier) : tier;
  const isLocked = locked || t.fill === null;
  const label = isLocked
    ? `${t.name} reviewer, ${BADGE_STRINGS.locked}`
    : count !== undefined
      ? BADGE_STRINGS.reviewerLabel(t.name, count)
      : BADGE_STRINGS.reviewerLabelNoCount(t.name);
  const cls = [styles.chip, isLocked ? styles.locked : t.special ? styles.special : '', className].filter(Boolean).join(' ');
  return (
    <span className={cls} style={tierVars(t)} aria-label={label} role="img" data-tier={t.key}>
      <span aria-hidden="true">{t.name}</span>
    </span>
  );
}
