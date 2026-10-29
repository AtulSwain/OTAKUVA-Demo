import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHead } from '../../components/ui/PageHead';
import { getChart, listPublishedCharts } from '@control/lib/charts';
import styles from './charts.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Charts · OTAKUVA', description: 'Ranked anime charts made by the OTAKUVA team.' };

/** Every published OTAKUVA chart (made in the control center). */
export default async function ChartsIndex() {
  const charts = await listPublishedCharts().catch(() => []);
  const previews = await Promise.all(charts.map((c) => getChart(c.id).then((full) => full?.items.slice(0, 4) ?? [])));
  return (
    <div className={styles.page}>
      <PageHead kicker="OTAKUVA" title="Charts" />
      {charts.length === 0 ? (
        <p className={styles.empty}>No charts published yet.</p>
      ) : (
        <div className={styles.grid}>
          {charts.map((c, i) => (
            <Link key={c.id} href={`/charts/${c.slug}`} className={styles.card}>
              <span className={styles.stack} aria-hidden="true">
                {previews[i].map((p) =>
                  p.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.animeId} src={p.posterUrl} alt="" loading="lazy" />
                  ) : null,
                )}
              </span>
              <strong>{c.title}</strong>
              <span>{c.entries} anime</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
