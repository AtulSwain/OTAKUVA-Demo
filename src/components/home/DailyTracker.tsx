'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Flame,
  Clock,
  CheckCircle,
  Plus,
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
  Target,
  Settings,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';
import { FIXTURE_ANIMES } from '../../fixtures/anime.fixture';
import styles from './DailyTracker.module.css';

interface DailyTrackerProps {
  onOpenQuickLog?: () => void;
}

export const DailyTracker: React.FC<DailyTrackerProps> = ({ onOpenQuickLog }) => {
  const {
    library,
    counts,
    advanceOneEpisode,
    todayEpisodes,
    todayMinutes,
    dailyGoal,
    setDailyGoal,
    streakDays,
  } = useLibrary();

  const [showGoalSelector, setShowGoalSelector] = useState(false);
  const [showTimer, setShowTimer] = useState(false);

  // Watch Session Timer State (24 minutes = 1440 seconds)
  const [timerSeconds, setTimerSeconds] = useState(24 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [selectedTimerAnimeId, setSelectedTimerAnimeId] = useState<string>('');

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
      // Auto advance selected anime if timer finishes
      if (selectedTimerAnimeId) {
        advanceOneEpisode(selectedTimerAnimeId);
      }
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds, selectedTimerAnimeId, advanceOneEpisode]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const animeMap = useMemo(() => new Map(FIXTURE_ANIMES.map((a) => [a.id, a])), []);

  const watchingList = useMemo(() => {
    return Object.values(library)
      .filter((i) => i.status === 'watching')
      .map((entry) => ({
        entry,
        anime: entry.anime || animeMap.get(entry.animeId) || {
          id: entry.animeId,
          title: entry.animeId.replace(/-/g, ' '),
          episodes: 24,
        },
      }))
      .slice(0, 4);
  }, [library, animeMap]);

  // Set default timer anime
  useEffect(() => {
    if (watchingList.length > 0 && !selectedTimerAnimeId) {
      setSelectedTimerAnimeId(watchingList[0].entry.animeId);
    }
  }, [watchingList, selectedTimerAnimeId]);

  const goalProgress = Math.min(100, Math.round((todayEpisodes / dailyGoal) * 100));
  const isGoalReached = todayEpisodes >= dailyGoal;

  const daysOfWeek = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const currentDayIndex = (new Date().getDay() + 6) % 7; // Monday = 0

  return (
    <div className={styles.container}>
      {/* Daily Metrics Grid */}
      <div className={styles.metricsGrid}>
        {/* Metric 1: Real-time Today's Watch Time */}
        <div className={styles.metricCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>TODAY&apos;S WATCH TIME</span>
            <Clock size={13} className={styles.cardIcon} />
          </div>
          <div className={styles.valRow}>
            <span className={styles.mainVal}>{todayEpisodes} eps</span>
            <span className={styles.subVal}>({todayMinutes} mins)</span>
          </div>
          <span className={styles.cardFooter}>
            {todayEpisodes > 0 ? 'Logged in real time today' : 'No episodes logged yet today'}
          </span>
        </div>

        {/* Metric 2: Live Daily Goal Progress with Custom Adjuster */}
        <div className={styles.metricCard}>
          <div className={styles.cardHeader}>
            <div className={styles.goalHeaderRow}>
              <span className={styles.cardTitle}>DAILY GOAL</span>
              <button
                type="button"
                className={styles.goalEditBtn}
                onClick={() => setShowGoalSelector((prev) => !prev)}
                title="Change daily goal"
              >
                <Settings size={10} />
              </button>
            </div>
            <Target size={13} className={isGoalReached ? styles.trophyIcon : styles.cardIcon} />
          </div>

          <div className={styles.valRow}>
            <span className={styles.mainVal}>
              {todayEpisodes} / {dailyGoal}
            </span>
            <span className={styles.subVal}>({goalProgress}%)</span>
          </div>

          <div className={styles.progressBar}>
            <div
              className={`${styles.progressFill} ${isGoalReached ? styles.progressComplete : ''}`}
              style={{ width: `${goalProgress}%` }}
            />
          </div>

          {showGoalSelector && (
            <div className={styles.goalSelectorPopover}>
              <span className={styles.popoverTitle}>Set Daily Goal:</span>
              <div className={styles.goalOptions}>
                {[1, 2, 3, 4, 5, 8].map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`${styles.goalOptionBtn} ${dailyGoal === g ? styles.goalOptionActive : ''}`}
                    onClick={() => {
                      setDailyGoal(g);
                      setShowGoalSelector(false);
                    }}
                  >
                    {g} ep
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Metric 3: Active Streak & Weekly Consistency Dots */}
        <div className={styles.metricCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>DAILY STREAK</span>
            <Flame size={13} className={styles.streakIcon} />
          </div>
          <div className={styles.valRow}>
            <span className={styles.mainVal}>{streakDays} Days</span>
            <span className={styles.subVal}>🔥 Active</span>
          </div>
          {/* 7-Day Consistency Dots */}
          <div className={styles.weekDots}>
            {daysOfWeek.map((day, idx) => {
              const isPast = idx < currentDayIndex;
              const isToday = idx === currentDayIndex;
              return (
                <div
                  key={idx}
                  className={`${styles.dayDot} ${isPast || (isToday && todayEpisodes > 0) ? styles.dayDotActive : ''} ${isToday ? styles.dayDotToday : ''}`}
                  title={`${day}: ${isToday ? `${todayEpisodes} eps today` : 'Goal met'}`}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        {/* Metric 4: Watch Focus Session / Timer Trigger */}
        <div className={styles.metricCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>WATCH SESSION</span>
            <Sparkles size={13} className={styles.cardIcon} />
          </div>
          <div className={styles.valRow}>
            <span className={styles.mainVal}>{formatTimer(timerSeconds)}</span>
            <span className={styles.subVal}>{isTimerRunning ? 'Playing' : 'Ready'}</span>
          </div>
          <div className={styles.timerControls}>
            <button
              type="button"
              className={styles.timerBtn}
              onClick={() => setIsTimerRunning((prev) => !prev)}
            >
              {isTimerRunning ? <Pause size={10} /> : <Play size={10} />}
              <span>{isTimerRunning ? 'Pause' : 'Start 24m'}</span>
            </button>
            <button
              type="button"
              className={styles.timerResetBtn}
              onClick={() => {
                setIsTimerRunning(false);
                setTimerSeconds(24 * 60);
              }}
              title="Reset 24m timer"
            >
              <RotateCcw size={10} />
            </button>
          </div>
        </div>
      </div>

      {/* Goal Reached Celebration Banner */}
      {isGoalReached && (
        <div className={styles.celebrationBanner}>
          <Trophy size={14} className={styles.trophyIcon} />
          <span className={styles.celebrationText}>
            <strong>Daily Goal Achieved!</strong> You&apos;ve logged {todayEpisodes} episodes today. Keep up the momentum!
          </span>
        </div>
      )}

      {/* 1-Click Logging Strip */}
      {watchingList.length > 0 && (
        <div className={styles.quickStrip}>
          <span className={styles.stripLabel}>1-CLICK QUICK LOG:</span>
          <div className={styles.quickItems}>
            {watchingList.map(({ entry, anime }) => {
              const currentEp = entry.episodesWatched || 0;
              const nextEp = currentEp + 1;
              return (
                <div key={entry.animeId} className={styles.quickItem}>
                  <Link href={`/anime/${anime.id}`} className={styles.animeName}>
                    {anime.title}
                  </Link>
                  <span className={styles.epIndicator}>Ep {currentEp}</span>
                  <button
                    type="button"
                    className={styles.plusBtn}
                    onClick={() => advanceOneEpisode(entry.animeId, anime.episodes)}
                    title={`Log Episode ${nextEp}`}
                  >
                    <Plus size={11} />
                    <span>+1 Ep</span>
                  </button>
                </div>
              );
            })}
          </div>

          {onOpenQuickLog && (
            <button
              type="button"
              className={styles.moreBtn}
              onClick={onOpenQuickLog}
            >
              + All Titles
            </button>
          )}
        </div>
      )}
    </div>
  );
};
