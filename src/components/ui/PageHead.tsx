import React from 'react';
import styles from './PageHead.module.css';

/**
 * The site's page header: small kicker with the accent bar, a large title and
 * an optional one-line description. Same look as the schedule and news pages
 * (and SectionHead, one size up), so every top-level page reads as one product.
 */
export function PageHead({
  kicker,
  title,
  children,
  actions,
}: {
  kicker: string;
  title: string;
  /** Short description under the title. */
  children?: React.ReactNode;
  /** Controls shown at the right of the title (e.g. view toggles). */
  actions?: React.ReactNode;
}) {
  return (
    <header className={styles.head}>
      <div className={styles.text}>
        <p className={styles.kicker}>{kicker}</p>
        <h1 className={styles.title}>{title}</h1>
        {children && <p className={styles.subtitle}>{children}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
