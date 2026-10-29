import React from 'react';
import type { Metadata } from 'next';
import { PageHead } from '../../components/ui/PageHead';
import { SectionHead } from '../../components/ui/SectionHead';
import { FoundingTimeline, StudiosDirectory } from '../../components/studios/StudiosDirectory';
import { getFoundingTimeline, getStudioDirectoryStats, queryStudioDirectory } from '../../lib/studios/studioDirectory';
import styles from '../../components/studios/StudiosDirectory.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Animation Studios',
  description: 'Every animation studio in the OTAKUVA catalog — when they were founded, what they made and what they are known for.',
};

/**
 * Studios directory (2026-10-28 rebuild): rendered on the server from one
 * cached query (was a client fetch that showed skeletons for seconds and
 * only ever listed 24 studios). Founding timeline by decade, then every
 * studio with search / sort / status filter and infinite scroll.
 */
export default async function StudiosPage() {
  const [first, decades, stats] = await Promise.all([queryStudioDirectory({ limit: 48 }), getFoundingTimeline(8), getStudioDirectoryStats()]);
  const whole = new Intl.NumberFormat('en-US');

  return (
    <div className={styles.page}>
      <PageHead kicker="Studios" title="Animation Studios" />
      <ul className={styles.stats}>
        <li>
          <b>{whole.format(stats.studios)}</b> studios
        </li>
        {stats.founded > 0 && (
          <li>
            <b>{whole.format(stats.founded)}</b> with founding dates
          </li>
        )}
        {stats.closed > 0 && (
          <li>
            <b>{whole.format(stats.closed)}</b> closed
          </li>
        )}
      </ul>

      {decades.length > 1 && (
        <section className={styles.section} aria-labelledby="studios-timeline">
          <SectionHead kicker="Timeline" title="Founded through the decades" id="studios-timeline" />
          <FoundingTimeline decades={decades} />
        </section>
      )}

      <section className={styles.section} aria-labelledby="studios-all">
        <SectionHead kicker="Directory" title="All studios" id="studios-all" />
        <StudiosDirectory initial={first.studios} total={first.total} />
      </section>
    </div>
  );
}
