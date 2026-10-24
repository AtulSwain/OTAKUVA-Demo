import React from 'react';
import Link from 'next/link';
import { EntityLink, EntityType } from '../shared';
import { AnimeImage } from './AnimeImage';
import styles from '../../app/anime/[id]/anime.module.css';

export interface DossierPerson {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string | null;
  role?: string;
}

export const DossierPeopleSection: React.FC<{ title: string; people: DossierPerson[]; type: EntityType }> = ({ title, people, type }) => (
  <section className={styles.section} aria-label={title}>
    <div className={styles.sectionHead}><h2>{title}</h2><Link href={type === 'character' ? '/characters' : '/people'}>View all →</Link></div>
    {people.length > 0 ? <div className={styles.peopleRows}>
      {people.slice(0, 8).map((person) => (
        <EntityLink key={person.id} type={type} slug={person.slug} className={styles.personRow}>
          <span className={styles.avatar}><AnimeImage src={person.imageUrl} alt="" fill sizes="52px" /></span>
          <span><strong>{person.name}</strong><small>{person.role || (type === 'character' ? 'Character' : 'Crew')}</small></span>
          <em>{person.role || 'Credit'}</em>
        </EntityLink>
      ))}
    </div> : <p className={styles.emptyState}>No {title.toLowerCase()} on record yet for this title</p>}
  </section>
);
