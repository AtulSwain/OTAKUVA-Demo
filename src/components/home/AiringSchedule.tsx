'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Clock, Star, Bell, Sparkles } from 'lucide-react';
import { Anime } from '../../types/anime';
import { getAnimeDisplayTitle } from '../../lib/animeTitleResolver';
import styles from './AiringSchedule.module.css';

interface ScheduleItem {
  id: string;
  animeId: string;
  slug: string;
  title: string;
  canonicalTitle?: string;
  posterImage: string;
  bannerImage?: string;
  episode: number;
  airingAt: string;
  timeUntilAiring?: number;
  day: string;
  score?: number;
  genres: string[];
}

interface AiringScheduleProps {
  animes?: Anime[];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

function formatCountdown(airingAtIso: string): string {
  const diff = new Date(airingAtIso).getTime() - Date.now();
  if (diff <= 0) return 'Aired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}

function formatAiringTime(airingAtIso: string): string {
  const date = new Date(airingAtIso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const AiringSchedule: React.FC<AiringScheduleProps> = ({ animes = [] }) => {
  const todayDayName = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] || 'Monday';
  const [selectedDay, setSelectedDay] = useState<string>(todayDayName);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSchedule() {
      try {
        const res = await fetch('/api/schedule');
        if (res.ok) {
          const data = await res.json();
          if (data.schedule && data.schedule.length > 0) {
            setSchedules(data.schedule);
          }
        }
      } catch (err) {
        console.error('Failed to load live schedule:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSchedule();
  }, []);

  const dayItems = schedules.filter((s) => s.day.toLowerCase() === selectedDay.toLowerCase());
  const displayItems = dayItems.length > 0 ? dayItems : schedules.slice(0, 8);

  return (
    <section className={styles.scheduleSection} aria-label="Weekly Broadcast Schedule">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Calendar size={16} className={styles.icon} />
          <div>
            <h2 className={styles.title}>Weekly Broadcast Schedule</h2>
            <p className={styles.subtitle}>
              Live airing timestamps &amp; episode countdowns
            </p>
          </div>
        </div>

        <div className={styles.dayTabs} role="tablist" aria-label="Select day of week">
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              className={`${styles.dayBtn} ${selectedDay === day ? styles.dayBtnActive : ''}`}
              role="tab"
              aria-selected={selectedDay === day}
              onClick={() => setSelectedDay(day)}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.scheduleGrid}>
        {displayItems.length > 0 ? (
          displayItems.map((item) => {
            const displayTitle = getAnimeDisplayTitle(item);
            return (
              <Link
                key={item.id}
                href={`/anime/${item.slug || item.animeId}`}
                className={styles.card}
              >
                <div className={styles.posterWrapper}>
                  <Image
                    src={item.posterImage || (item as any).posterUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100&auto=format&fit=crop&q=60'}
                    alt={displayTitle}
                    fill
                    className={styles.poster}
                    sizes="40px"
                    unoptimized
                  />
                </div>
                <div className={styles.cardInfo}>
                  <h4 className={styles.animeTitle} title={displayTitle}>
                    {displayTitle}
                  </h4>
                  <div className={styles.timePill}>
                    <Clock size={10} />
                    <span>{formatAiringTime(item.airingAt)} ({formatCountdown(item.airingAt)})</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.epBadge}>Ep {item.episode}</span>
                    <span className={styles.metaDot}>•</span>
                    <span className={styles.genreText}>{item.genres?.slice(0, 2).join(', ') || 'Anime'}</span>
                  </div>
                </div>
              </Link>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            No scheduled broadcasts for {selectedDay}. Check another day of the week.
          </div>
        )}
      </div>
    </section>
  );
};
