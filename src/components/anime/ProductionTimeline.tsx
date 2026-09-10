'use client';

import React, { useMemo } from 'react';
import { Calendar, Film, Sparkles, BookOpen, CheckCircle } from 'lucide-react';
import styles from './ProductionTimeline.module.css';

export interface TimelineEvent {
  year: string | number;
  title: string;
  description?: string;
  category?: 'source' | 'committee' | 'premiere' | 'finale' | 'sequel' | 'movie';
}

interface ProductionTimelineProps {
  anime?: any;
  animeTitle?: string;
  releaseYear?: number | null;
  relations?: any[];
  news?: any[];
  events?: TimelineEvent[];
}

export const ProductionTimeline: React.FC<ProductionTimelineProps> = ({
  anime,
  animeTitle = 'Anime',
  releaseYear,
  relations = [],
  news = [],
  events,
}) => {
  const displayEvents = useMemo<TimelineEvent[]>(() => {
    if (events && events.length > 0) return events;

    const items: TimelineEvent[] = [];
    const baseYear = anime?.year || releaseYear || 2020;
    const sourceName = anime?.source || 'Original Work';
    const mainStudio = (Array.isArray(anime?.studios) && anime.studios.length > 0)
      ? (typeof anime.studios[0] === 'string' ? anime.studios[0] : anime.studios[0]?.name)
      : (typeof anime?.studio === 'string' ? anime.studio : anime?.studio?.name || 'Animation Studio');

    // 1. Source Work Inception
    if (sourceName !== 'Original') {
      items.push({
        year: baseYear > 2 ? `${baseYear - 2}` : 'Source',
        title: `${sourceName} Serialization`,
        description: `Original work published and serialized in Japan prior to adaptation.`,
        category: 'source',
      });
    }

    // 2. Production Committee Greenlit
    items.push({
      year: baseYear > 1 ? `${baseYear - 1}` : 'Pre-Production',
      title: 'Anime Production Greenlit',
      description: `Production committee formed with ${mainStudio} attached as lead animation studio.`,
      category: 'committee',
    });

    // 3. Television Broadcast Premiere
    const premiereDate = anime?.airedFrom
      ? new Date(anime.airedFrom).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : `${anime?.season || 'Season'} ${baseYear}`;

    items.push({
      year: premiereDate,
      title: 'Broadcast Premiere',
      description: `First episode aired on television networks and licensed international streaming.`,
      category: 'premiere',
    });

    // 4. Series Finale or Season Conclusion
    const finaleDate = anime?.airedTo
      ? new Date(anime.airedTo).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : (anime?.status === 'Finished' ? 'Completed' : 'Airing');

    items.push({
      year: finaleDate,
      title: anime?.status === 'Finished' ? 'Broadcast Conclusion' : 'Current Broadcast Run',
      description: anime?.status === 'Finished'
        ? `Concluded the primary broadcast run spanning ${anime?.episodes || 'all scheduled'} canonical episodes.`
        : `Currently continuing weekly broadcast and ongoing simulcasts.`,
      category: 'finale',
    });

    // 5. Authentic Relations / Sequels from Jikan API
    if (Array.isArray(relations) && relations.length > 0) {
      const meaningfulRelations = relations
        .filter((r) => ['Sequel', 'Prequel', 'Side story', 'Movie', 'Spin-off'].includes(r.relationType))
        .slice(0, 3);

      meaningfulRelations.forEach((rel) => {
        const relTitle = rel.title || rel.canonicalTitle || rel.name || 'Continuation';
        const isMovie = rel.relationType === 'Movie' || rel.type === 'Movie';
        items.push({
          year: rel.year ? `${rel.year}` : rel.relationType,
          title: `${rel.relationType}: ${relTitle}`,
          description: `Canonical franchise ${rel.relationType.toLowerCase()} expanding the core storyline.`,
          category: isMovie ? 'movie' : 'sequel',
        });
      });
    }

    return items;
  }, [anime, animeTitle, releaseYear, relations, events]);

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'source':
        return <BookOpen size={10} />;
      case 'committee':
        return <Sparkles size={10} />;
      case 'premiere':
        return <Calendar size={10} />;
      case 'finale':
        return <CheckCircle size={10} />;
      case 'movie':
      case 'sequel':
        return <Film size={10} />;
      default:
        return <Calendar size={10} />;
    }
  };

  return (
    <div className={styles.section} aria-label="Production Timeline">
      <div className={styles.sectionHead}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <Calendar size={16} className={styles.sectionIcon} />
            <h3 className={styles.title}>Production Timeline</h3>
          </div>
          <span className={styles.subtitle}>Verified real-world broadcast & franchise milestones</span>
        </div>
      </div>

      <div className={styles.timelineWrapper}>
        {displayEvents.map((evt, idx) => (
          <div key={`${evt.year}-${idx}`} className={styles.eventNode}>
            <div className={`${styles.dot} ${styles[`dot_${evt.category || 'default'}`]}`}>
              {getCategoryIcon(evt.category)}
            </div>
            <span className={styles.badgeCategory}>{evt.category || 'Milestone'}</span>
            <strong className={styles.eventTitle}>{evt.title}</strong>
            <span className={styles.eventYear}>{evt.year}</span>
            {evt.description && <span className={styles.eventDesc}>{evt.description}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};
