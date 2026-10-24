import React from 'react';
import Link from 'next/link';
import styles from './ComingNext.module.css';

interface ComingItem {
  id: string;
  episodeNumber: number;
  airingAt: string;
  anime: { slug?: string; id: string; title: string };
}

interface ComingNextProps {
  items: ComingItem[];
}

function formatAiringTime(airingAt: string) {
  const date = new Date(airingAt);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const day = sameDay ? 'Tonight' : new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.round((date.getTime() - now.getTime()) / 86400000),
    'day'
  );
  return `${day} · ${time}`;
}

export const ComingNext: React.FC<ComingNextProps> = ({ items }) => (
  <section className={styles.section} aria-label="Coming Next">
    <div className={styles.sectionHead}>
      <h2>Coming Next</h2>
      <Link href="/schedule">View schedule →</Link>
    </div>
    <div className={styles.list}>
      {items.slice(0, 5).map((item) => (
        <Link key={item.id} href={`/anime/${item.anime.slug || item.anime.id}`} className={styles.row}>
          <div>
            <strong>{item.anime.title}</strong>
            <span>Episode {item.episodeNumber || 'next'} is on the way.</span>
          </div>
          <time dateTime={item.airingAt}>{formatAiringTime(item.airingAt)}</time>
        </Link>
      ))}
    </div>
  </section>
);
