import styles from './PageSkeleton.module.css';

/** Generic page placeholder for route transitions (server component, no JS). */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className={styles.bar} />
      <div className={styles.page}>
        <div className={`${styles.block} ${styles.title}`} />
        <div className={`${styles.block} ${styles.line}`} />
        <div className={styles.row}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${styles.block} ${styles.card}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Anime detail placeholder: matches the hero's shape so the page doesn't jump. */
export function AnimeDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading anime">
      <div className={styles.bar} />
      <div className={styles.hero}>
        <div className={`${styles.block} ${styles.poster}`} />
        <div className={styles.heroText}>
          <div className={`${styles.block} ${styles.line}`} style={{ width: 220 }} />
          <div className={`${styles.block} ${styles.heroTitle}`} />
          <div className={`${styles.block} ${styles.line}`} />
          <div className={`${styles.block} ${styles.line}`} style={{ width: '50%' }} />
        </div>
      </div>
    </div>
  );
}
