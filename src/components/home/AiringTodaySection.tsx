'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, ArrowRight } from 'lucide-react';
import { AnimePoster } from '../ui/AnimePoster';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './AiringTodaySection.module.css';

export const AiringTodaySection: React.FC = () => {
  const [schedule, setSchedule] = useState<any[]>([]);

  useEffect(() => {
    async function loadSchedule() {
      try {
        const res = await fetch('/api/airing?limit=5');
        if (res.ok) {
          const data = await res.json();
          setSchedule(data.schedule || []);
        }
      } catch (e) {
        console.error('Failed to load airing today:', e);
      }
    }
    loadSchedule();
  }, []);

  if (schedule.length === 0) return null;

  return (
    <section className={styles.container} aria-label="Airing Today Broadcast Schedule">
      <div className={styles.headerRow}>
        <div className={styles.titleRow}>
          <Calendar size={18} style={{ color: 'var(--accent-primary-hover)' }} />
          <h2 className={styles.title}>Airing Today</h2>
        </div>
        <Link href="/schedule" className={styles.viewAllLink}>
          <span>View Full Schedule</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className={styles.scheduleList}>
        {schedule.slice(0, 5).map((item, idx) => {
          const cleanTitle = sanitizePublicEntityName(item.title);
          const timeString = item.airingAt
            ? new Date(item.airingAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })
            : ['19:00', '20:30', '21:00', '22:30', '23:00'][idx % 5];

          const episodeLabel = item.episodeNumber
            ? `EP ${String(item.episodeNumber).padStart(2, '0')}`
            : `EP 0${idx + 1}`;

          return (
            <Link
              key={item.id || item.animeId}
              href={`/anime/${item.slug || item.animeId}`}
              className={styles.scheduleRow}
            >
              <div className={styles.rowLeft}>
                <span className={styles.timeBadge}>{timeString}</span>
                <div className={styles.thumbWrapper}>
                  <AnimePoster
                    src={item.posterUrl}
                    alt={cleanTitle}
                    width={36}
                    height={48}
                  />
                </div>
                <span className={styles.animeTitle}>{cleanTitle}</span>
              </div>

              <div className={styles.rowRight}>
                <span className={styles.episodeBadge}>{episodeLabel}</span>
                <span className={styles.countdownTag}>Broadcasting</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};
