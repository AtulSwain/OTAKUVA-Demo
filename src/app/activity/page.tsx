'use client';

import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ActivityHeatmap } from '../../components/profile/ActivityHeatmap';
import { ActivityTimeline, TimelineActivity } from '../../components/profile/ActivityTimeline';
import styles from './activity.module.css';

export default function ActivityPage() {
  const [activities, setActivities] = useState<TimelineActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const { user, isLoading: authLoading, openAuthModal } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setActivities([]);
      setIsLoading(false);
      return;
    }
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
  }, [user, authLoading]);

  // Type names as stored (Activity.type). The tabs used to test
  // WATCHED_EPISODE / RATED_ANIME / COMPLETED_ANIME, which never occur, so
  // every tab but "All" was always empty.
  const FILTERS: Record<string, string[]> = {
    LIBRARY: ['ADDED_TO_LIBRARY', 'STATUS_CHANGED', 'ANIME_FAVORITED', 'LIST_CREATED'],
    WATCHED: ['EPISODE_WATCHED'],
    COMPLETED: ['ANIME_COMPLETED', 'ANIME_RATED', 'REVIEW_CREATED'],
    POSTS: ['DISCUSSION_CREATED', 'ARTICLE_PUBLISHED'],
    COMMUNITY: ['JOINED_COMMUNITY'],
  };
  const filteredActivities = filterType === 'ALL' ? activities : activities.filter((act) => FILTERS[filterType]?.includes(act.type));

  if (!authLoading && !user) {
    return (
      <div className={styles.activityPage}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <Activity size={20} className={styles.headerIcon} aria-hidden="true" />
            <h1 className={styles.title}>Your activity</h1>
          </div>
          <p className={styles.subtitle}>Sign in to see what you&apos;ve watched, rated, reviewed and posted.</p>
        </div>
        <div>
          <button type="button" className={styles.signInBtn} onClick={() => openAuthModal('login')}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.activityPage}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Activity size={20} className={styles.headerIcon} />
          <h1 className={styles.title}>Your activity</h1>
        </div>
      </div>

      {/* GitHub-style 365-Day Heatmap */}
      <ActivityHeatmap activities={activities} />

      {/* Filter Tabs */}
      <div className={styles.filterRow} role="tablist">
        {[
          { key: 'ALL', label: 'All' },
          { key: 'LIBRARY', label: 'Library' },
          { key: 'WATCHED', label: 'Episodes' },
          { key: 'COMPLETED', label: 'Completed & rated' },
          { key: 'POSTS', label: 'Posts' },
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
