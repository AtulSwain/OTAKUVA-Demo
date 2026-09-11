'use client';

import React from 'react';
import Link from 'next/link';
import {
  Play,
  CheckCircle2,
  Bookmark,
  MessageSquare,
  Users,
  Star,
  Flame,
  Clock,
  Activity as ActivityIcon,
} from 'lucide-react';
import styles from './ActivityTimeline.module.css';

export interface TimelineActivity {
  id: string;
  type: string;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  anime?: {
    id: string;
    slug: string;
    title: string;
    posterImage?: string;
    type?: string;
  } | null;
  metadata?: {
    episodeNumber?: number;
    rating?: number;
    discussionId?: string;
    title?: string;
    communityId?: string;
    communityName?: string;
    slug?: string;
    status?: string;
  };
}

interface ActivityTimelineProps {
  activities?: TimelineActivity[];
  isLoading?: boolean;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities = [],
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <span>Loading activity history...</span>
      </div>
    );
  }

  // Only this user's recorded activity. An empty history used to be filled
  // with five invented actions ("rated Frieren 10", "joined Fantasy & Magic
  // Worldbuilding") shown as if the profile owner had done them.
  const displayActivities = activities;

  const renderIcon = (type: string) => {
    switch (type) {
      case 'WATCHED_EPISODE':
        return <Play size={12} className={styles.actionIcon} />;
      case 'RATED_ANIME':
      case 'COMPLETED_ANIME':
        return <CheckCircle2 size={12} className={styles.actionIcon} />;
      case 'STATUS_UPDATED':
        return <Bookmark size={12} className={styles.actionIcon} />;
      case 'DISCUSSION_CREATED':
      case 'COMMENT_CREATED':
        return <MessageSquare size={12} className={styles.actionIcon} />;
      case 'JOINED_COMMUNITY':
        return <Users size={12} className={styles.actionIcon} />;
      default:
        return <ActivityIcon size={12} className={styles.actionIcon} />;
    }
  };

  const renderContent = (act: TimelineActivity) => {
    const meta = act.metadata || {};

    if (act.type === 'WATCHED_EPISODE') {
      return (
        <span>
          Watched <strong>Episode {meta.episodeNumber || 1}</strong> of{' '}
          {act.anime ? (
            <Link href={`/anime/${act.anime.slug || act.anime.id}`} className={styles.entityLink}>
              {act.anime.title}
            </Link>
          ) : (
            'an anime series'
          )}
        </span>
      );
    }

    if (act.type === 'RATED_ANIME' || (act.type === 'STATUS_UPDATED' && meta.status === 'completed')) {
      return (
        <span>
          Completed{' '}
          {act.anime ? (
            <Link href={`/anime/${act.anime.slug || act.anime.id}`} className={styles.entityLink}>
              {act.anime.title}
            </Link>
          ) : (
            'anime'
          )}
          {meta.rating ? (
            <span className={styles.scoreBadge}><Star size={12} fill="currentColor" aria-hidden="true" /> {meta.rating}/10</span>
          ) : null}
        </span>
      );
    }

    if (act.type === 'STATUS_UPDATED') {
      return (
        <span>
          Updated status to <strong>{meta.status?.replace('_', ' ') || 'Watching'}</strong> for{' '}
          {act.anime ? (
            <Link href={`/anime/${act.anime.slug || act.anime.id}`} className={styles.entityLink}>
              {act.anime.title}
            </Link>
          ) : (
            'anime'
          )}
        </span>
      );
    }

    if (act.type === 'DISCUSSION_CREATED') {
      return (
        <span>
          Started discussion{' '}
          <Link href={`/discussions/${meta.discussionId || act.id}`} className={styles.entityLink}>
            &ldquo;{meta.title || 'Discussion'}&rdquo;
          </Link>
        </span>
      );
    }

    if (act.type === 'JOINED_COMMUNITY') {
      return (
        <span>
          Joined community{' '}
          <Link href={`/community/${meta.slug || meta.communityId || ''}`} className={styles.entityLink}>
            {meta.communityName || 'a community'}
          </Link>
        </span>
      );
    }

    return <span>Logged activity event</span>;
  };

  return (
    <div className={styles.timelineCard}>
      <div className={styles.timelineHeader}>
        <h3 className={styles.timelineTitle}>Activity Feed</h3>
        <span className={styles.timelineSubtitle}>Contribution overview and chronological logs</span>
      </div>

      {displayActivities.length === 0 && (
        <div className={styles.loadingContainer}>
          <span>No activity yet.</span>
        </div>
      )}

      <div className={styles.timelineList}>
        {displayActivities.map((act, index) => {
          const date = new Date(act.createdAt);
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          return (
            <div key={act.id || index} className={styles.timelineItem}>
              <div className={styles.timelineAxis}>
                <div className={styles.nodeIconWrap}>{renderIcon(act.type)}</div>
                {index < displayActivities.length - 1 && <div className={styles.timelineLine} />}
              </div>

              <div className={styles.timelineContent}>
                <div className={styles.activityBody}>{renderContent(act)}</div>
                <span className={styles.activityTime}>{dateStr} at {timeStr}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
