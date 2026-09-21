import { notFound } from 'next/navigation';
import { TIERS } from '../../../lib/badges/tiers';
import { Seal, BadgeChip, BadgeTooltip } from '../../../components/badges';
import TierProgress from '../../../components/badges/TierProgress';
import BadgeLadder from '../../../components/badges/BadgeLadder';
import BadgeDistribution from '../../../components/badges/BadgeDistribution';
import SegmentedBadgeBar from '../../../components/badges/SegmentedBadgeBar';
import LabToast from './LabToast';
import { SAMPLE_ANIME, SAMPLE_COMMUNITIES } from '../../../fixtures/badges/sampleData';
import styles from '../badges.module.css';

export const metadata = { title: 'Badge lab (development)', robots: { index: false, follow: false } };

/**
 * Visual test page: every component, every tier, both themes. Uses PLACEHOLDER
 * fixture data, so it does not exist in production builds.
 */
export default function BadgeLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const mecha = SAMPLE_COMMUNITIES[0].byTier ?? {};
  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.title}>Badge lab</h1>
        <p className={styles.intro}>Development only. PLACEHOLDER data from src/fixtures/badges/sampleData.ts.</p>
      </header>
      <div className={styles.themes}>
        {(['dark', 'light'] as const).map((theme) => (
          <section key={theme} data-badge-theme={theme} className={`${styles.panel} ${theme === 'dark' ? styles.panelDark : styles.panelLight}`}>
            <h2 className={styles.panelTitle}>{theme}</h2>

            <h3 className={styles.h2}>Seal: 88 / 46 / 32</h3>
            {TIERS.map((t) => (
              <div key={t.key} className={styles.sizes}>
                <Seal tier={t} size="lg" />
                <Seal tier={t} size="md" />
                <Seal tier={t} size="sm" />
                <BadgeTooltip tier={t}>
                  <BadgeChip tier={t} count={t.min} />
                </BadgeTooltip>
              </div>
            ))}

            <h3 className={styles.h2}>Ladder (Sensei)</h3>
            <BadgeLadder current="sensei" />

            <h3 className={styles.h2}>Progress</h3>
            <TierProgress count={532} />
            <TierProgress count={0} />
            <TierProgress count={1500} />

            <h3 className={styles.h2}>Distribution ({SAMPLE_ANIME.title})</h3>
            <BadgeDistribution counts={{ ...SAMPLE_ANIME.byTier, densetsu: 1 }} />

            <h3 className={styles.h2}>Segmented bar (Mecha Mondays)</h3>
            <SegmentedBadgeBar counts={mecha} />

            <h3 className={styles.h2}>Unlock toast</h3>
            <LabToast />
          </section>
        ))}
      </div>
    </div>
  );
}
