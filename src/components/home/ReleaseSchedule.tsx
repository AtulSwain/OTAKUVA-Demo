'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Clock } from 'lucide-react';
import { AnimeImage } from '../anime/AnimeImage';
import styles from './ReleaseSchedule.module.css';

export interface ReleaseScheduleItem {
  id: string;
  episode: number;
  airingAt: string;
  anime: {
    id: string;
    slug: string;
    title: string;
    posterUrl: string | null;
    type: string;
    totalEpisodes: number | null;
  };
}

const DAYS_SHOWN = 7;
const COLLAPSED_ROWS = 12;

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function countdown(ms: number) {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

/**
 * Homepage release schedule: Today / Tomorrow / the rest of the week, with
 * exact air times in the viewer's own timezone. Grouping depends on that
 * timezone, so it happens after mount (the server renders a skeleton).
 * Times are real AniList broadcast timestamps — nothing is estimated here.
 */
export function ReleaseSchedule({ items }: { items: ReleaseScheduleItem[] }) {
  const [now, setNow] = useState<Date | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const days = useMemo(() => {
    if (!now) return [];
    const today = startOfLocalDay(now);
    return Array.from({ length: DAYS_SHOWN }, (_, i) => {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i + 1);
      const label =
        i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : start.toLocaleDateString(undefined, { weekday: 'long' });
      const date = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const entries = items
        .filter((it) => {
          const t = new Date(it.airingAt).getTime();
          return t >= start.getTime() && t < end.getTime();
        })
        .sort((a, b) => new Date(a.airingAt).getTime() - new Date(b.airingAt).getTime());
      return { label, date, entries };
    });
  }, [items, now]);

  const timeZone = useMemo(() => {
    if (!now) return null;
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return null;
    }
  }, [now]);

  const active = days[dayIndex];
  const visible = active ? (expanded ? active.entries : active.entries.slice(0, COLLAPSED_ROWS)) : [];
  // On today's list, mark where "now" falls between aired and upcoming.
  const nowMarkerAt =
    now && dayIndex === 0 ? visible.findIndex((e) => new Date(e.airingAt).getTime() > now.getTime()) : -1;

  return (
    <section className={styles.section} aria-labelledby="release-schedule-title">
      <div className={styles.head}>
        <div>
          <h2 id="release-schedule-title" className={styles.title}>
            Release Schedule
          </h2>
          <p className={styles.sub}>
            <Clock size={13} aria-hidden="true" />
            {timeZone ? `Times in your timezone · ${timeZone.replace(/_/g, ' ')}` : 'Times in your timezone'}
          </p>
        </div>
        <Link href="/schedule" className={styles.fullLink}>
          Full schedule <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>

      {!now ? (
        <div className={styles.skeleton} aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>
      ) : (
        <>
          <div className={styles.tabs} role="tablist" aria-label="Day">
            {days.map((d, i) => (
              <button
                key={d.label + d.date}
                type="button"
                role="tab"
                id={`rs-tab-${i}`}
                aria-selected={dayIndex === i}
                aria-controls="rs-panel"
                className={`${styles.tab} ${dayIndex === i ? styles.tabActive : ''}`}
                onClick={() => {
                  setDayIndex(i);
                  setExpanded(false);
                }}
              >
                <span className={styles.tabLabel}>{d.label}</span>
                <span className={styles.tabMeta}>
                  {d.date} · {d.entries.length}
                </span>
              </button>
            ))}
          </div>

          <div id="rs-panel" role="tabpanel" aria-labelledby={`rs-tab-${dayIndex}`}>
            {active && active.entries.length === 0 ? (
              <p className={styles.empty}>No episodes scheduled for {active.label.toLowerCase()} yet.</p>
            ) : (
              <ol className={styles.list}>
                {visible.map((e, i) => {
                  const at = new Date(e.airingAt);
                  const diff = at.getTime() - now.getTime();
                  const aired = diff <= 0;
                  const ofTotal = e.anime.totalEpisodes ? ` of ${e.anime.totalEpisodes}` : '';
                  return (
                    <React.Fragment key={e.id}>
                      {i === nowMarkerAt && i > 0 && (
                        <li className={styles.nowMarker} aria-label="Now">
                          <span>Now</span>
                        </li>
                      )}
                      <li>
                        <Link href={`/anime/${e.anime.slug}`} className={`${styles.row} ${aired ? styles.rowAired : ''}`}>
                          <time className={styles.time} dateTime={e.airingAt}>
                            {at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                          </time>
                          <span className={styles.poster}>
                            <AnimeImage src={e.anime.posterUrl || undefined} alt="" fill sizes="44px" />
                          </span>
                          <span className={styles.info}>
                            <span className={styles.animeTitle}>{e.anime.title}</span>
                            <span className={styles.meta}>
                              Episode {e.episode}
                              {ofTotal} · {e.anime.type}
                            </span>
                          </span>
                          <span className={`${styles.status} ${aired ? styles.statusAired : diff < 3_600_000 ? styles.statusSoon : ''}`}>
                            {aired ? (
                              <>
                                <Check size={13} aria-hidden="true" /> Out
                              </>
                            ) : diff < 24 * 3_600_000 ? (
                              countdown(diff)
                            ) : (
                              'Upcoming'
                            )}
                          </span>
                        </Link>
                      </li>
                    </React.Fragment>
                  );
                })}
              </ol>
            )}

            {active && active.entries.length > COLLAPSED_ROWS && (
              <button type="button" className={styles.more} onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Show less' : `Show all ${active.entries.length} episodes`}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
