'use client';

import React from 'react';
import { Calendar, Film, CheckCircle } from 'lucide-react';
import styles from './ProductionTimeline.module.css';
import type { TimelineEvent } from './timelineEvents';

export { buildTimelineEvents } from './timelineEvents';
export type { TimelineEvent } from './timelineEvents';

interface ProductionTimelineProps {
  events: TimelineEvent[];
}

const getCategoryIcon = (category?: string) => {
  switch (category) {
    case 'finale':
      return <CheckCircle size={10} aria-hidden="true" />;
    case 'movie':
    case 'sequel':
      return <Film size={10} aria-hidden="true" />;
    default:
      return <Calendar size={10} aria-hidden="true" />;
  }
};

export const ProductionTimeline: React.FC<ProductionTimelineProps> = ({ events }) => {
  if (events.length === 0) return null;

  return (
    <div className={styles.section} aria-label="Timeline">
      <div className={styles.sectionHead}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <Calendar size={16} className={styles.sectionIcon} aria-hidden="true" />
            <h3 className={styles.title}>Timeline</h3>
          </div>
          <span className={styles.subtitle}>Recorded air dates and franchise entries</span>
        </div>
      </div>

      <ol className={styles.timelineWrapper}>
        {events.map((evt, idx) => (
          <li key={`${evt.sortKey}-${idx}`} className={styles.eventNode}>
            <div className={`${styles.dot} ${styles[`dot_${evt.category || 'default'}`]}`}>
              {getCategoryIcon(evt.category)}
            </div>
            <span className={styles.badgeCategory}>{evt.category || 'Milestone'}</span>
            <strong className={styles.eventTitle}>{evt.title}</strong>
            <span className={styles.eventYear}>{evt.year}</span>
            {evt.description && <span className={styles.eventDesc}>{evt.description}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
};
