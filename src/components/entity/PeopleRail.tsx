'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { isProviderPlaceholderImage } from '../../lib/mediaResolver';
import styles from './Entity.module.css';

/** Round portrait; falls back to the person's initials when the photo is missing or broken. */
export function PersonAvatar({ name, src }: { name: string; src?: string | null }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  // Black-and-grey tile (matches the UI); a slightly different shade per name.
  const shade = 20 + ([...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 11) % 10);
  return (
    <span className={styles.avatar} style={{ background: `linear-gradient(140deg, hsl(0 0% ${shade}%), hsl(0 0% 7%))` }}>
      <span className={styles.avatarInitials} aria-hidden="true">{initials}</span>
      {src && !failed && !isProviderPlaceholderImage(src) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" className={styles.avatarImg} onError={() => setFailed(true)} />
      )}
    </span>
  );
}

export interface RailPerson {
  id: string;
  slug: string | null;
  name: string;
  imageUrl?: string | null;
  /** Second line, e.g. "Director / Script". */
  role?: string | null;
  /** Third line, e.g. "Cowboy Bebop" or "12 shared works". */
  note?: string | null;
}

/** Sideways row of round portraits linking to creator pages — the homepage "Creators" look. */
export function PeopleRail({ people }: { people: RailPerson[] }) {
  return (
    <div className={styles.peopleRail}>
      {people.map((p) => (
        <Link key={p.id} href={`/person/${p.slug || p.id}`} className={styles.personCard}>
          <PersonAvatar name={p.name} src={p.imageUrl} />
          <span className={styles.personName}>{p.name}</span>
          {p.role && <span className={styles.personRole}>{p.role}</span>}
          {p.note && <span className={styles.personNote}>{p.note}</span>}
        </Link>
      ))}
    </div>
  );
}
