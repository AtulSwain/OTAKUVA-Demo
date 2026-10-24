import { CommunityScoreBadge } from '../rating/CommunityScoreBadge';
import React from 'react';
import Link from 'next/link';

import styles from './Entity.module.css';

/** "Known for" poster row (the homepage season-row look). */
export function PosterRow({
  items,
}: {
  items: { id: string; slug: string; title: string; posterUrl: string | null; score?: number | null; note?: string | null }[];
}) {
  return (
    <div className={styles.posterRow}>
      {items.map((a) => (
        <Link key={a.id} href={`/anime/${a.slug}`} className={styles.posterCard}>
          <span className={styles.poster}>
            {a.posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.posterUrl} alt="" loading="lazy" decoding="async" />
            )}
            {/* Members' OTAKUVA score + retention (not the provider score). */}
            <CommunityScoreBadge animeId={a.id} variant="overlay" />
          </span>
          <strong>{a.title}</strong>
          {a.note && <span>{a.note}</span>}
        </Link>
      ))}
    </div>
  );
}

/** Works per year as small bars; years with nothing still get a slot so gaps show. */
export function WorksTimeline({ timeline, unit = 'work' }: { timeline: { year: number; count: number }[]; unit?: string }) {
  if (timeline.length < 2) return null;
  const max = Math.max(...timeline.map((t) => t.count), 1);
  const peak = timeline.reduce((a, b) => (b.count > a.count ? b : a));
  const label = (n: number) => `${n} ${n === 1 ? unit : `${unit}s`}`;
  // Year labels: first, last and every decade start, so long careers stay readable.
  const showYear = (y: number, i: number) => i === 0 || i === timeline.length - 1 || y % 10 === 0;
  return (
    <figure className={styles.timeline}>
      <div className={styles.bars} role="img" aria-label={`${label(timeline.reduce((s, t) => s + t.count, 0))} from ${timeline[0].year} to ${timeline[timeline.length - 1].year}; busiest year ${peak.year} with ${label(peak.count)}.`}>
        {timeline.map((t, i) => (
          <span key={t.year} className={styles.barCol} title={`${t.year}: ${label(t.count)}`}>
            <span className={`${styles.bar} ${t === peak ? styles.barPeak : ''}`} style={{ height: `${t.count ? Math.max(6, (t.count / max) * 100) : 0}%` }} />
            <span className={styles.barYear} aria-hidden="true">{showYear(t.year, i) ? t.year : ''}</span>
          </span>
        ))}
      </div>
      <figcaption className={styles.caption}>
        Busiest year: <strong>{peak.year}</strong> with {label(peak.count)}.
      </figcaption>
    </figure>
  );
}

/** Genre chips with counts, linking to the catalog filter. */
export function GenreChips({ genres }: { genres: { name: string; count: number }[] }) {
  return (
    <ul className={styles.genreChips}>
      {genres.map((g) => (
        <li key={g.name}>
          <Link href={`/anime?genre=${encodeURIComponent(g.name)}`}>
            {g.name}
            <span>{g.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Stat tiles in the hero (the homepage masthead look). Zero/unknown values are skipped by the caller. */
export function StatTiles({ stats }: { stats: { value: string; label: string }[] }) {
  if (stats.length === 0) return null;
  return (
    <ul className={styles.stats}>
      {stats.map((s) => (
        <li key={s.label}>
          <strong>{s.value}</strong>
          <span>{s.label}</span>
        </li>
      ))}
    </ul>
  );
}
