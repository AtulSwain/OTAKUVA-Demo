import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import styles from './SectionHead.module.css';

/**
 * The site's section heading: small kicker with the accent bar, a bold title,
 * and an optional "see all" link. Used by the homepage, studio and creator
 * pages so they read as one product.
 */
export function SectionHead({
  kicker,
  title,
  href,
  linkLabel,
  id,
  count,
}: {
  kicker: string;
  title: string;
  href?: string;
  linkLabel?: string;
  id?: string;
  /** Optional number shown beside the title (e.g. how many works). */
  count?: number;
}) {
  return (
    <div className={styles.head}>
      <div>
        <p className={styles.kicker}>{kicker}</p>
        <h2 className={styles.title} id={id}>
          {title}
          {count !== undefined && <span className={styles.count}>{count.toLocaleString('en-US')}</span>}
        </h2>
      </div>
      {href && (
        <Link href={href} className={styles.more}>
          {linkLabel || 'See all'} <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
