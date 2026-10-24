import React from 'react';
import Link from 'next/link';
import { AnimeImage } from '../anime/AnimeImage';
import styles from './PeopleBehindStories.module.css';
import { EntityLink } from '../shared/EntityLink';

interface PersonItem {
  id: string;
  slug: string;
  name: string;
  role?: string;
  imageUrl?: string | null;
  knownFor?: Array<{ posterImage?: string }>;
}

export const PeopleBehindStories: React.FC<{ people: PersonItem[] }> = ({ people }) => (
  <section className={styles.section} aria-label="People Behind the Stories">
    <div className={styles.sectionHead}>
      <h2>People Behind the Stories</h2>
      <Link href="/people">View people →</Link>
    </div>
    <div className={styles.list}>
      {people.slice(0, 5).map((person) => (
        <EntityLink key={person.id} type="person" slug={person.slug} className={styles.row}>
          <span className={styles.identity}>
            <span className={styles.avatar}>
              <AnimeImage src={person.imageUrl || person.knownFor?.[0]?.posterImage} alt="" fill sizes="52px" />
            </span>
            <span><strong>{person.name}</strong><small>{person.role || 'Anime creator'}</small></span>
          </span>
          <span className={styles.roleTag}>{person.role || 'Creator'}</span>
        </EntityLink>
      ))}
    </div>
  </section>
);
