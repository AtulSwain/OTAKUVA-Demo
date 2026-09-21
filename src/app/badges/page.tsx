import type { Metadata } from 'next';
import { TIERS } from '../../lib/badges/tiers';
import { BADGE_STRINGS, glossFor } from '../../lib/badges/strings';
import { Seal, BadgeChip, BadgeTooltip } from '../../components/badges';
import styles from './badges.module.css';

export const metadata: Metadata = {
  title: 'Reviewer badges — OTAKUVA',
  description: BADGE_STRINGS.galleryIntro,
};

const THEMES = [
  { theme: 'dark', cls: styles.panelDark, label: 'Dark' },
  { theme: 'light', cls: styles.panelLight, label: 'Light' },
] as const;

/** Public reference for the ladder. Reads only from the tier config — no sample data. */
export default function BadgeGalleryPage() {
  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.title}>{BADGE_STRINGS.galleryTitle}</h1>
        <p className={styles.intro}>{BADGE_STRINGS.galleryIntro}</p>
      </header>

      <div className={styles.themes}>
        {THEMES.map(({ theme, cls, label }) => (
          <section key={theme} className={`${styles.panel} ${cls}`} data-badge-theme={theme} aria-label={`${label} theme`}>
            <h2 className={styles.panelTitle}>{label}</h2>
            <ul className={styles.list}>
              {TIERS.map((t) => (
                <li key={t.key} className={styles.item}>
                  <BadgeTooltip tier={t}>
                    <Seal tier={t} size="lg" />
                  </BadgeTooltip>
                  <div className={styles.meta}>
                    <span className={styles.name}>{t.name} <span lang="ja">{t.kanjiFull}</span></span>
                    <span className={styles.sub}>{glossFor(t.glossKey)}</span>
                    <span className={styles.thr}>{BADGE_STRINGS.tooltipRequires(t.min)}</span>
                    <span><BadgeChip tier={t} /></span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
