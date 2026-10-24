import Link from 'next/link';
import type { SeasonSeries, SeriesEntry } from '../../lib/catalog/seasonSeries';
import styles from './SeasonBar.module.css';

function meta(e: SeriesEntry) {
  return [e.year, e.episodes ? `${e.episodes} ep${e.episodes === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ');
}

function Chip({ e }: { e: SeriesEntry }) {
  const sub = meta(e);
  return (
    <li>
      <Link
        href={`/anime/${e.slug}`}
        className={`${styles.chip} ${e.isCurrent ? styles.chipCurrent : ''}`}
        aria-current={e.isCurrent ? 'page' : undefined}
        title={e.title}
      >
        <span className={styles.chipLabel}>{e.label}</span>
        {sub && <span className={styles.chipMeta}>{sub}</span>}
      </Link>
    </li>
  );
}

/**
 * "N seasons" bar: shown only when a show has two or more TV/ONA seasons in
 * the catalog. Each chip opens that season's own page. Films/OVAs/specials
 * from the same chain are listed after it.
 */
export function SeasonBar({ series }: { series: SeasonSeries | null }) {
  if (!series || series.seasons.length < 2) return null;
  const { seasons, extras } = series;
  return (
    <nav className={styles.bar} aria-label="Seasons">
      <div className={styles.head}>
        <h2 className={styles.title}>{seasons.length} Seasons</h2>
      </div>
      <ol className={styles.track}>
        {seasons.map((e) => (
          <Chip key={e.id} e={e} />
        ))}
      </ol>
      {extras.length > 0 && (
        <>
          <p className={styles.subhead}>Movies &amp; specials</p>
          <ul className={styles.track}>
            {extras.map((e) => (
              <Chip key={e.id} e={{ ...e, label: e.label === 'Season 1' ? e.title : e.label }} />
            ))}
          </ul>
        </>
      )}
    </nav>
  );
}
