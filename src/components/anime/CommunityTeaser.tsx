'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import styles from './CommunityTeaser.module.css';

interface DiscussionThread {
  id?: string;
  title?: string;
  authorName?: string;
  user?: {
    username?: string;
    name?: string;
  };
  author?: {
    username?: string;
    name?: string;
  };
  replyCount?: number;
  commentsCount?: number;
  repliesCount?: number;
  timeAgo?: string;
  createdAt?: string;
}

interface CommunityTeaserProps {
  animeTitle: string;
  discussions?: DiscussionThread[];
  onOpenDiscussionsTab?: () => void;
  onOpenReviewsTab?: () => void;
}

const DEFAULT_DISCUSSIONS: DiscussionThread[] = [
  {
    id: 'disc-1',
    title: 'What did you think of the ending?',
    authorName: 'Eren_TheFreedom',
    replyCount: 1240,
    timeAgo: '2d ago',
  },
  {
    id: 'disc-2',
    title: 'Your favorite character and why?',
    authorName: 'HistoriaFan',
    replyCount: 856,
    timeAgo: '3d ago',
  },
];

export const CommunityTeaser: React.FC<CommunityTeaserProps> = ({
  animeTitle,
  discussions = [],
  onOpenDiscussionsTab,
}) => {
  const items = discussions && discussions.length > 0 ? discussions.slice(0, 3) : DEFAULT_DISCUSSIONS;

  return (
    <div className={styles.card} role="region" aria-label="Community Discussions">
      <div className={styles.headerRow}>
        <h3 className={styles.headerTitle}>Community Discussions</h3>
        <Link href="/community" className={styles.viewAllLink}>
          <span>View All</span>
          <ChevronRight size={12} />
        </Link>
      </div>

      <div className={styles.discussionsList}>
        {items.map((disc, idx) => {
          const rawAuthor =
            disc.authorName ||
            disc.user?.username ||
            disc.user?.name ||
            disc.author?.username ||
            disc.author?.name ||
            'OtakuMember';
          const author = String(rawAuthor || 'OtakuMember');
          const initial = (author.trim() || 'OM').slice(0, 2).toUpperCase();

          const replies =
            typeof disc.replyCount === 'number'
              ? disc.replyCount
              : (typeof disc.commentsCount === 'number'
                ? disc.commentsCount
                : (typeof disc.repliesCount === 'number' ? disc.repliesCount : 42));
          const replyBadge = replies > 999 ? `${(replies / 1000).toFixed(1)}K` : `${replies}`;
          const title = disc.title || `Discussion #${idx + 1}`;

          return (
            <Link
              key={disc.id || idx}
              href={`/discussions/${disc.id || idx}`}
              className={styles.discussionItem}
            >
              <div className={styles.itemLeft}>
                <div className={styles.avatar}>
                  <span>{initial}</span>
                </div>
                <div className={styles.textBlock}>
                  <span className={styles.discussionTitle}>{title}</span>
                  <span className={styles.discussionMeta}>
                    by {author} · {replies} replies · {disc.timeAgo || 'recently'}
                  </span>
                </div>
              </div>

              <span className={styles.repliesBadge}>{replyBadge}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
