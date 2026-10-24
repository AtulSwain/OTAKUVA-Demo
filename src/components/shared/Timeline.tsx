import React from 'react';
import styles from './Timeline.module.css';

export interface TimelineEvent {
  id: string;
  title: string;
  date?: string;
  description?: string;
  locked?: boolean;
}

export interface TimelineProps {
  events: TimelineEvent[];
}

export const Timeline: React.FC<TimelineProps> = ({ events }) => (
  <ol className={styles.timeline}>
    {events.map((event) => (
      <li key={event.id} className={`${styles.event} ${event.locked ? styles.locked : ''}`}>
        <span className={styles.dot} aria-hidden="true" />
        <div className={styles.content}>
          <div className={styles.eventHead}>
            <strong>{event.title}</strong>
            {event.locked ? <span className={styles.soon}>SOON</span> : event.date && <time>{event.date}</time>}
          </div>
          {event.description && <p>{event.description}</p>}
        </div>
      </li>
    ))}
  </ol>
);
