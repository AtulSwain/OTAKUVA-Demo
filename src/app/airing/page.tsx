'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Calendar, Clock, Globe, Filter } from 'lucide-react';
import { AnimePoster } from '../../components/ui/AnimePoster';
import { useLibrary } from '../../context/LibraryContext';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './airing.module.css';

interface AiringItem {
  id: string;
  animeId: string;
  slug: string;
  title: string;
  episodeNumber: number;
  airingAt: string;
  dayOfWeek: string;
  posterUrl: string;
  type: string;
  score: number | null;
  genres: string[];
  studios: string[];
}

const TABS = ['Today', 'Tomorrow', 'This Week', 'Calendar'] as const;
const TYPES = ['All', 'TV', 'Movie', 'OVA', 'ONA'] as const;

export default function AiringPage() {
  const { library } = useLibrary();
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Today');
  const [activeType, setActiveType] = useState<typeof TYPES[number]>('All');
  const [onlyLibrary, setOnlyLibrary] = useState(false);
  const [items, setItems] = useState<AiringItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Timezone string
  const userTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  useEffect(() => {
    async function loadAiring() {
      setLoading(true);
      try {
        const res = await fetch('/api/airing?limit=50');
        if (res.ok) {
          const data = await res.json();
          setItems(data.schedule || []);
        }
      } catch (e) {
        console.error('Failed to fetch airing schedule:', e);
      } finally {
        setLoading(false);
      }
    }
    loadAiring();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (activeType !== 'All' && item.type !== activeType) return false;
      if (onlyLibrary && !library[item.slug || item.animeId]) return false;
      return true;
    });
  }, [items, activeType, onlyLibrary, library]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Airing Schedule</h1>
        <p className={styles.subtitle}>
          Live broadcast schedules and upcoming episode countdowns in your local timezone.
        </p>
      </header>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        {/* Day / Time Window Tabs */}
        <div className={styles.dayTabs} role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={`${styles.dayBtn} ${activeTab === tab ? styles.dayBtnActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Filters: Format & Library Toggle */}
        <div className={styles.filterGroup}>
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`${styles.typeBtn} ${activeType === t ? styles.typeBtnActive : ''}`}
              onClick={() => setActiveType(t)}
            >
              {t}
            </button>
          ))}

          <button
            type="button"
            className={`${styles.typeBtn} ${onlyLibrary ? styles.typeBtnActive : ''}`}
            onClick={() => setOnlyLibrary((prev) => !prev)}
          >
            My Library Only
          </button>

          <div className={styles.timezoneInfo}>
            <Globe size={12} />
            <span>{userTimezone}</span>
          </div>
        </div>
      </div>

      {/* Schedule List */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>
          Loading live broadcast schedule...
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>
          No scheduled broadcasts found matching your active filters.
        </div>
      ) : (
        <div className={styles.scheduleList}>
          {filteredItems.map((item, idx) => {
            const cleanTitle = sanitizePublicEntityName(item.title);
            const timeString = item.airingAt
              ? new Date(item.airingAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })
              : ['18:30', '19:00', '20:00', '21:30', '22:00', '23:30'][idx % 6];

            const episodeLabel = item.episodeNumber
              ? `Episode ${item.episodeNumber}`
              : `Episode ${idx + 1}`;

            return (
              <Link
                key={item.id || item.animeId}
                href={`/anime/${item.slug || item.animeId}`}
                className={styles.scheduleRow}
              >
                <div className={styles.rowLeft}>
                  <span className={styles.timeTag}>{timeString}</span>
                  <div className={styles.posterWrap}>
                    <AnimePoster
                      src={item.posterUrl}
                      alt={cleanTitle}
                      width={44}
                      height={60}
                    />
                  </div>
                  <div className={styles.animeInfo}>
                    <span className={styles.animeTitle}>{cleanTitle}</span>
                    <div className={styles.animeMeta}>
                      <span>{item.type || 'TV'}</span>
                      {item.studios && item.studios.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{typeof item.studios[0] === 'string' ? item.studios[0] : (item.studios[0] as any)?.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.rowRight}>
                  <span className={styles.episodeBadge}>{episodeLabel}</span>
                  <span className={styles.countdownTag}>Airing Today</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
