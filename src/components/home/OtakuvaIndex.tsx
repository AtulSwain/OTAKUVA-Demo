'use client';

import React from 'react';
import Link from 'next/link';
import {
  Flame,
  Tv,
  Calendar,
  MessageSquare,
  Clock,
  Sparkles,
  Compass,
  ChevronRight,
} from 'lucide-react';
import styles from './OtakuvaIndex.module.css';

interface IndexPathway {
  title: string;
  subtitle: string;
  href: string;
  icon: React.ElementType;
  badge: string;
}

const PATHWAYS: IndexPathway[] = [
  {
    title: 'Trending Now',
    subtitle: 'High-velocity popular titles with active community engagement',
    href: '/discover?sort=POPULARITY_DESC',
    icon: Flame,
    badge: 'LIVE',
  },
  {
    title: 'Currently Airing',
    subtitle: 'Ongoing seasonal broadcasts airing across Japan this week',
    href: '/seasonal',
    icon: Tv,
    badge: 'WEEKLY',
  },
  {
    title: 'Upcoming Releases',
    subtitle: 'Anticipated productions, official dates, and release forecasts',
    href: '/seasonal?view=upcoming',
    icon: Calendar,
    badge: 'FUTURE',
  },
  {
    title: 'Most Discussed',
    subtitle: 'Top active discussion threads, deep lore theories, and episode debates',
    href: '/community',
    icon: MessageSquare,
    badge: 'COMMUNITY',
  },
  {
    title: 'Historical Eras',
    subtitle: 'From the 1960s golden era to modern animation masterpieces',
    href: '/history',
    icon: Clock,
    badge: 'ARCHIVE',
  },
  {
    title: 'Master Studios',
    subtitle: 'Founding histories, production timelines, and studio catalogues',
    href: '/studios',
    icon: Sparkles,
    badge: 'KNOWLEDGE',
  },
];

export const OtakuvaIndex: React.FC = () => {
  return (
    <section className={styles.container} aria-label="OTAKUVA Index Pathways">
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.signatureBadge}>
            <Compass size={12} />
            <span>KNOWLEDGE &amp; DISCOVERY RAIL</span>
          </div>
          <h2 className={styles.title}>OTAKUVA INDEX</h2>
          <p className={styles.subtitle}>
            Direct curated pathways through Japan&apos;s canonical animation ecosystem, production archives, and active community hubs.
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        {PATHWAYS.map((p) => {
          const Icon = p.icon;
          return (
            <Link key={p.title} href={p.href} className={styles.pathwayCard}>
              <div className={styles.cardTop}>
                <div className={styles.iconBox}>
                  <Icon size={18} />
                </div>
                <span className={styles.badge}>{p.badge}</span>
              </div>

              <div className={styles.cardContent}>
                <h3 className={styles.cardTitle}>{p.title}</h3>
                <p className={styles.cardSubtitle}>{p.subtitle}</p>
              </div>

              <div className={styles.cardBottom}>
                <span className={styles.actionLink}>
                  <span>Explore Index</span>
                  <ChevronRight size={13} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};
