'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Flame, TrendingUp, Users, Sparkles, Filter } from 'lucide-react';
import { ActivityHeatmap } from '../../components/profile/ActivityHeatmap';
import { ActivityTimeline, TimelineActivity } from '../../components/profile/ActivityTimeline';
import styles from './activity.module.css';

export default function ActivityPage() {
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');

  useEffect(() => {
    const fetchActivities = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/activities?limit=50');
        if (res.ok) {
          const data = await res.json();
          setActivities(data.activities || []);
        }
      } catch (err) {
        console.error('Failed to fetch activity feed:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchActivities();
  }, []);

  const filteredActivities = activities.filter((act) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'WATCHED') return act.type === 'WATCHED_EPISODE';
    if (filterType === 'COMPLETED') return act.type === 'RATED_ANIME' || act.type === 'COMPLETED_ANIME';
    if (filterType === 'DISCUSSIONS') return act.type === 'DISCUSSION_CREATED' || act.type === 'COMMENT_CREATED';
    if (filterType === 'COMMUNITY') return act.type === 'JOINED_COMMUNITY';
    return true;
  });

  return (
    <div className={styles.activityPage}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Activity size={20} className={styles.headerIcon} />
          <h1 className={styles.title}>ACTIVITY &amp; CONTRIBUTIONS</h1>
        </div>
        <p className={styles.subtitle}>
          Real-time chronological timeline of anime watch sessions, library logs, and community interactions.
        </p>
      </div>

      {/* GitHub-style 365-Day Heatmap */}
      <ActivityHeatmap activities={activities} />

      {/* Filter Tabs */}
      <div className={styles.filterRow} role="tablist">
        {[
          { key: 'ALL', label: 'All Activities' },
          { key: 'WATCHED', label: 'Episodes Watched' },
          { key: 'COMPLETED', label: 'Completed & Rated' },
          { key: 'DISCUSSIONS', label: 'Discussions' },
          { key: 'COMMUNITY', label: 'Communities' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${styles.filterBtn} ${filterType === tab.key ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterType(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* GitHub-style Activity Timeline Feed */}
      <ActivityTimeline activities={filteredActivities} isLoading={isLoading} />
    </div>
  );
}
