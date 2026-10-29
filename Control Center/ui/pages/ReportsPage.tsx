import Link from 'next/link';
import { getMostHyped, getMostRated, getMostReviewed, getWorstRated, type DashAnime } from '@control/lib/dashboard';
import { getControlOverview } from '@control/lib/overview';
import { ReportPrintButton } from './ReportPrintButton';
import styles from '../control.module.css';

const REPORTS = [
  ['overview', 'Everything', 'A concise operating snapshot across accounts, catalog and community.'],
  ['hyped', 'Most hyped anime', 'Current HYPED votes, ranked by community anticipation.'],
  ['rated', 'Most rated anime', 'Anime with the most members contributing episode ratings.'],
  ['reviewed', 'Most reviewed anime', 'Anime with the largest published review volume.'],
  ['worst', 'Worst anime', 'Lowest community score with a three-rating minimum.'],
  ['quality', 'Catalog quality', 'Missing artwork, trailers, synopses and people images to fix.'],
] as const;

function AnimeTable({ title, rows, unit }: { title: string; rows: DashAnime[]; unit: string }) {
  return <section className={styles.reportSection}>
    <h2>{title}</h2>
    <table className={styles.reportTable}><thead><tr><th>#</th><th>Anime</th><th>Count</th><th>30-day signal</th></tr></thead>
      <tbody>{rows.map((a, i) => <tr key={a.id}><td>{i + 1}</td><td>{a.title}</td><td>{a.count} {unit}</td><td>{a.extra ?? '—'}</td></tr>)}</tbody>
    </table>
    {!rows.length && <p className={styles.caption}>No data yet.</p>}
  </section>;
}

export async function ReportsPage({ type }: { type: string }) {
  const selected = REPORTS.some((r) => r[0] === type) ? type : 'overview';
  const [overview, hyped, rated, reviewed, worst] = await Promise.all([getControlOverview(), getMostHyped(25), getMostRated(25), getMostReviewed(25), getWorstRated(25)]);
  return <div className={styles.page}>
    <header className={`${styles.head} ${styles.reportHeader}`}><p className={styles.kicker}>Operations</p><h1 className={styles.title}>Report studio</h1><p className={styles.caption}>Generate a print-ready snapshot from live control-center data.</p><div className={styles.headActions}><ReportPrintButton /></div></header>
    <nav className={styles.reportNav} aria-label="Report types">{REPORTS.map(([id, label, note]) => <Link key={id} href={`/control/reports?type=${id}`} className={selected === id ? styles.chipOn : styles.chip} title={note}>{label}</Link>)}</nav>
    <div className={styles.reportMeta}><span>Generated {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date())} IST</span><span>Source: live database</span></div>
    {selected === 'overview' && <section className={styles.reportSection}><h2>Everything</h2><div className={styles.reportStats}>{[['Accounts', overview.users.total], ['Anime', overview.catalog.anime], ['People', overview.people.total], ['Studios', overview.studios.total], ['Open reports', overview.community.openReports], ['New accounts (7d)', overview.users.new7d]].map(([label, value]) => <div className={styles.reportStat} key={String(label)}><span>{label}</span><strong>{Number(value).toLocaleString()}</strong></div>)}</div><p className={styles.caption}>This report is designed for printing or saving as PDF. Use the focused reports for ranked anime lists.</p></section>}
    {selected === 'hyped' && <AnimeTable title="Most hyped anime" rows={hyped} unit="hype votes" />}
    {selected === 'rated' && <AnimeTable title="Most rated anime" rows={rated} unit="raters" />}
    {selected === 'reviewed' && <AnimeTable title="Most reviewed anime" rows={reviewed} unit="reviews" />}
    {selected === 'worst' && <AnimeTable title="Worst anime" rows={worst} unit="score" />}
    {selected === 'quality' && <section className={styles.reportSection}><h2>Catalog quality</h2><table className={styles.reportTable}><tbody>{[['Anime without a banner', overview.catalog.noBanner], ['Anime without a trailer', overview.catalog.noTrailer], ['Anime without a poster', overview.catalog.noPoster], ['Anime without a synopsis', overview.catalog.noSynopsis], ['Creators without a photo', overview.people.noPhoto], ['Characters without an image', overview.people.charactersNoImage], ['Studios without a logo', overview.studios.noLogo]].map(([label, value]) => <tr key={String(label)}><th>{label}</th><td>{Number(value).toLocaleString()}</td></tr>)}</tbody></table></section>}
  </div>;
}
