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

  // Fallback demo activities if none in database yet
  const displayActivities: TimelineActivity[] = activities.length > 0
    ? activities
    : [
        {
          id: 'act-1',
          type: 'WATCHED_EPISODE',
          createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          anime: { id: 'frieren', slug: 'frieren-beyond-journeys-end', title: "Frieren: Beyond Journey's End" },
          metadata: { episodeNumber: 28 },
        },
        {
          id: 'act-2',
          type: 'RATED_ANIME',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
          anime: { id: 'frieren', slug: 'frieren-beyond-journeys-end', title: "Frieren: Beyond Journey's End" },
          metadata: { rating: 10, status: 'completed' },
        },
        {
          id: 'act-3',
          type: 'DISCUSSION_CREATED',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
          metadata: { title: 'The subtle philosophy of time in Frieren', discussionId: 'disc-frieren-time' },
        },
        {
          id: 'act-4',
          type: 'JOINED_COMMUNITY',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
          metadata: { communityName: 'Fantasy & Magic Worldbuilding', slug: 'fantasy-magic' },
        },
        {
          id: 'act-5',
          type: 'STATUS_UPDATED',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
          anime: { id: 'jujutsu-kaisen', slug: 'jujutsu-kaisen-season-2', title: 'Jujutsu Kaisen Season 2' },
          metadata: { status: 'completed', rating: 9 },
        },
      ];

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
            <span className={styles.scoreBadge}>★ {meta.rating}/10</span>
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
