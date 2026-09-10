'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Clock, Star, Plus, Check, Bell, Globe, Sparkles, AlertCircle } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';
import { COMMON_TIMEZONES } from '../../lib/engine/schedule/scheduleTimezone';
import styles from './schedule.module.css';

interface EnrichedScheduleItem {
  id: string;
  animeId: string;
  slug: string;
  title: string;
  posterImage: string | null;
  bannerImage: string | null;
  episode: number;
  episodeId: string | null;
  episodeTitle: string | null;
  airingAt: string;
  localDate: string;
  localTime: string;
  localTime12h: string;
  weekday: string;
  day: string;
  status: string;
  airingStatus: string;
  releaseType: string;
  region: string;
  isVerified: boolean;
  delayReason: string | null;
  score: number | null;
  genres: string[];
  inLibrary: boolean;
  hasReminder: boolean;
  relativeTimeText: string;
  timeUntilAiringMs: number;
  seasonTitle: string | null;
  seasonNumber: number | null;
}

const PRESET_TABS = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'this_week', label: 'This Week' },
  { key: 'up_next', label: 'Up Next (For You)' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export default function SchedulePage() {
  const { library, updateStatus } = useLibrary();

  // State
  // Defaults to "This Week" rather than "Today": with a catalog that's
  // still filling in (see full_catalog_sync.ts), it's common for zero
  // shows to happen to air on the literal current day even though the
  // schedule has real upcoming entries — landing on an empty "Today" view
  // read as "the feature is broken" rather than "nothing airs today."
  const [activeTab, setActiveTab] = useState<string>('this_week');
  const [selectedDay, setSelectedDay] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [timezone, setTimezone] = useState<string>('UTC');
  const [libraryOnly, setLibraryOnly] = useState<boolean>(false);
  const [schedules, setSchedules] = useState<EnrichedScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [reminders, setReminders] = useState<Record<string, boolean>>({});

  // Detect local timezone on mount
  useEffect(() => {
    try {
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (localTz) {
        setTimezone(localTz);
      }
    } catch {
      setTimezone('UTC');
    }
  }, []);

  // Fetch schedule whenever tab, timezone, or library filter changes
  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'up_next') {
        const res = await fetch(`/api/schedule/up-next?timezone=${encodeURIComponent(timezone)}`);
        if (res.ok) {
          const json = await res.json();
          const items: EnrichedScheduleItem[] = json.data || [];
          setSchedules(items);
          const remMap: Record<string, boolean> = {};
          items.forEach((it) => { if (it.hasReminder) remMap[it.id] = true; });
          setReminders(remMap);
        }
      } else {
        const queryParams = new URLSearchParams({
          date: activeTab,
          timezone,
          library: libraryOnly ? 'true' : 'false',
        });
        if (statusFilter !== 'ALL') {
          queryParams.set('status', statusFilter);
        }
        const res = await fetch(`/api/schedule?${queryParams.toString()}`);
        if (res.ok) {
          const json = await res.json();
          const items: EnrichedScheduleItem[] = json.data || json.schedule || [];
          setSchedules(items);
          const remMap: Record<string, boolean> = {};
          items.forEach((it) => { if (it.hasReminder) remMap[it.id] = true; });
          setReminders(remMap);
        }
      }
    } catch (err) {
      console.error('Failed to load schedule:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, timezone, libraryOnly, statusFilter]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Handle Reminder Toggle
  const handleToggleReminder = async (scheduleId: string) => {
    try {
      const res = await fetch('/api/schedule/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId }),
      });
      if (res.ok) {
        const data = await res.json();
        setReminders((prev) => ({
          ...prev,
          [scheduleId]: !!data.active,
        }));
      }
    } catch (err) {
      console.error('Failed to toggle reminder:', err);
    }
  };

  // Filter items by Day (for 'this_week' view)
  const filteredItems = schedules.filter((item) => {
    if (activeTab === 'this_week' && selectedDay !== 'All') {
      return item.day.toLowerCase() === selectedDay.toLowerCase() || item.weekday.toLowerCase() === selectedDay.toLowerCase();
    }
    return true;
  });

  return (
    <div className={styles.schedulePage}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Calendar size={28} className={styles.icon} />
          <h1 className={styles.title}>Anime Release Schedule</h1>
        </div>
        <p className={styles.subtitle}>
          Real-time global broadcasting schedules, local timezone conversion, and verified release tracking.
        </p>
      </div>

      {/* Primary Navigation & Timezone Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.presetTabs}>
          {PRESET_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.presetBtn} ${activeTab === tab.key ? styles.presetBtnActive : ''}`}
              onClick={() => {
                setActiveTab(tab.key);
                setSelectedDay('All');
              }}
            >
              {tab.key === 'up_next' && <Sparkles size={13} style={{ marginRight: '5px', display: 'inline' }} />}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Timezone Selector */}
        <div className={styles.tzWrapper}>
          <span className={styles.tzLabel}>
            <Globe size={14} /> Timezone:
          </span>
          <select
            className={styles.tzSelect}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
            {!COMMON_TIMEZONES.some((tz) => tz.value === timezone) && (
              <option value={timezone}>{timezone}</option>
            )}
          </select>
        </div>
      </div>

      {/* Secondary Filter Bar */}
      <div className={styles.filterBar}>
        {activeTab === 'this_week' ? (
          <div className={styles.dayTabs}>
            <button
              type="button"
              className={`${styles.dayBtn} ${selectedDay === 'All' ? styles.dayBtnActive : ''}`}
              onClick={() => setSelectedDay('All')}
            >
              All Days
            </button>
            {DAYS.map((day) => (
              <button
                key={day}
                type="button"
                className={`${styles.dayBtn} ${selectedDay === day ? styles.dayBtnActive : ''}`}
                onClick={() => setSelectedDay(day)}
              >
                {day}
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.statusChips}>
            {['ALL', 'UPCOMING', 'AIRING', 'RELEASED', 'DELAYED'].map((st) => (
              <button
                key={st}
                type="button"
                className={`${styles.statusChip} ${statusFilter === st ? styles.statusChipActive : ''}`}
                onClick={() => setStatusFilter(st)}
              >
                {st === 'ALL' ? 'All Releases' : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        )}

        {activeTab !== 'up_next' && (
          <button
            type="button"
            className={`${styles.dayBtn} ${libraryOnly ? styles.dayBtnActive : ''}`}
            onClick={() => setLibraryOnly((curr) => !curr)}
          >
            In My Library
          </button>
        )}
      </div>

      {/* Schedule Content Grid */}
      {loading ? (
        <div style={{ color: 'var(--text-secondary)', padding: '36px', textAlign: 'center' }}>
          Loading live broadcasting schedule...
        </div>
      ) : filteredItems.length > 0 ? (
        <div className={styles.grid}>
          {filteredItems.map((item) => {
            const inLibrary = Boolean(item.inLibrary || library[item.animeId]);
            const isDelayed = item.airingStatus === 'DELAYED' || item.status === 'DELAYED';
            const isCancelled = item.airingStatus === 'CANCELLED' || item.status === 'CANCELLED';
            const isAiringNow = item.airingStatus === 'AIRING';
            const hasRem = !!reminders[item.id];

            return (
              <div key={item.id} className={styles.card}>
                <Link href={`/anime/${item.slug || item.animeId}`} className={styles.posterWrap}>
                  <Image
                    src={item.posterImage || 'https://placehold.co/100x140/14161C/5B5FEF?text=Anime'}
                    alt={item.title}
                    fill
                    className={styles.poster}
                    sizes="80px"
                  />
                </Link>

                <div className={styles.cardBody}>
                  <div>
                    {/* Badge Row */}
                    <div className={styles.badgeRow}>
                      <span className={styles.channelBadge}>{item.releaseType || 'Broadcast'}</span>
                      {item.seasonTitle && <span className={styles.seasonBadge}>{item.seasonTitle}</span>}
                    </div>

                    {/* Anime Title */}
                    <Link href={`/anime/${item.slug || item.animeId}`}>
                      <h3 className={styles.cardTitle} title={item.title}>
                        {item.title}
                      </h3>
                    </Link>

                    {/* Countdown / Status */}
                    <div
                      className={`${styles.countdownPill} ${
                        isAiringNow
                          ? styles.airingNowPill
                          : isDelayed
                          ? styles.delayedPill
                          : isCancelled
                          ? styles.cancelledPill
                          : ''
                      }`}
                    >
                      <Clock size={13} />
                      <span>
                        Ep {item.episode} • {item.relativeTimeText || item.airingStatus}
                      </span>
                    </div>

                    {/* Delay Notice if present */}
                    {isDelayed && (
                      <div className={styles.delayWarning} title={item.delayReason || 'Broadcast rescheduled'}>
                        <AlertCircle size={11} style={{ display: 'inline', marginRight: '3px' }} />
                        {item.delayReason || 'Broadcast delayed'}
                      </div>
                    )}
                  </div>

                  {/* Metadata & Actions */}
                  <div className={styles.metaRow}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.localTime || item.localTime12h}
                    </span>
                    <span>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#FACC15' }}>
                      <Star size={11} fill="#FACC15" />
                      {item.score ? item.score.toFixed(1) : 'N/A'}
                    </span>
                    <span>•</span>

                    {/* Reminder Bell Button */}
                    <button
                      type="button"
                      className={`${styles.bellBtn} ${hasRem ? styles.bellBtnActive : ''}`}
                      onClick={() => handleToggleReminder(item.id)}
                      title={hasRem ? 'Reminder Active' : 'Set Release Reminder'}
                    >
                      <Bell size={13} fill={hasRem ? '#FACC15' : 'none'} />
                    </button>

                    {/* Tracking Button */}
                    <button
                      type="button"
                      onClick={() =>
                        updateStatus(item.slug || item.animeId, inLibrary ? 'plan_to_watch' : 'watching')
                      }
                      className={`${styles.actionBtn} ${inLibrary ? styles.actionBtnActive : ''}`}
                    >
                      {inLibrary ? <Check size={12} /> : <Plus size={12} />}
                      <span>{inLibrary ? 'Tracking' : 'Add'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          {activeTab === 'up_next' ? (
            <div>
              <Sparkles size={32} style={{ color: 'var(--accent)', marginBottom: '12px' }} />
              <h3>No Upcoming Episodes in Your Library</h3>
              <p style={{ marginTop: '6px', fontSize: '13px' }}>
                Add anime to your &quot;Watching&quot; or &quot;Plan to Watch&quot; list to see your personalized Up Next feed.
              </p>
            </div>
          ) : (
            <div>
              <Calendar size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <h3>No Scheduled Broadcasts Found</h3>
              <p style={{ marginTop: '6px', fontSize: '13px' }}>
                Try selecting a different date range or changing your timezone.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
