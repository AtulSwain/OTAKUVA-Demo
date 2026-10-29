import Link from 'next/link';
import { ArrowRight, CalendarHeart, Film, ImagePlus, Library, Newspaper, Trophy } from 'lucide-react';
import { getControlOverview } from '@control/lib/overview';
import { getAccountActivity, getAiringNow, getMostHyped, getMostRated, getMostReviewed, getPremieringSoon, type DashAnime } from '@control/lib/dashboard';
import { getTodayPick } from '@control/lib/dailyPicks';
import styles from '../control.module.css';

const fmt = new Intl.NumberFormat('en-US');
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');
const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
const timeFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

function untilText(iso: string | null) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const d = Math.floor(ms / 86_400_000);
  if (d >= 1) return `in ${d} day${d === 1 ? '' : 's'}`;
  const h = Math.floor(ms / 3_600_000);
  return h >= 1 ? `in ${h}h` : `in ${Math.max(1, Math.floor(ms / 60_000))}m`;
}

function Stat({ label, value, note, href, tone }: { label: string; value: number | string; note?: string; href?: string; tone?: 'good' | 'warn' }) {
  const body = (
    <>
      <span className={styles.statLabel}>{label}</span>
      <strong className={`${styles.statValue} ${tone === 'good' ? styles.toneGood : tone === 'warn' ? styles.toneWarn : ''}`}>{typeof value === 'number' ? fmt.format(value) : value}</strong>
      {note && <span className={styles.statNote}>{note}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={`${styles.stat} ${styles.statLink}`}>
      {body}
    </Link>
  ) : (
    <div className={styles.stat}>{body}</div>
  );
}

function RankList({ title, items, unit, extraUnit, empty, chartHint }: { title: string; items: DashAnime[]; unit: string; extraUnit?: string; empty: string; chartHint?: boolean }) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h3>{title}</h3>
        {chartHint && items.length > 0 && (
          <Link href="/control/charts" className={styles.inlineLink}>
            Make a chart <ArrowRight size={12} />
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className={styles.caption}>{empty}</p>
      ) : (
        <ol className={styles.rankList}>
          {items.map((a, i) => (
            <li key={a.id}>
              <Link href={`/control/anime/${a.id}`} className={styles.rankRow}>
                <span className={styles.rankNo}>{i + 1}</span>
                <span className={styles.pickerThumb}>
                  {a.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.posterUrl} alt="" loading="lazy" />
                  ) : null}
                </span>
                <span className={styles.rowText}>
                  <strong>{a.title}</strong>
                  {extraUnit && a.extra !== undefined && <span>{fmt.format(a.extra)} {extraUnit}</span>}
                </span>
                <span className={styles.rankCount}>
                  {fmt.format(a.count)} <small>{unit}</small>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** The control center dashboard: members, what's premiering/airing, what's hot, what to fix. */
export default async function DashboardPage() {
  const [o, act, premiering, airing, hyped, reviewed, rated, todayPick] = await Promise.all([
    getControlOverview(),
    getAccountActivity(),
    getPremieringSoon(60, 24),
    getAiringNow(20),
    getMostHyped(10),
    getMostReviewed(10),
    getMostRated(10),
    getTodayPick(),
  ]);
  const maxSign = Math.max(1, ...o.signups.map((d) => d.count));
  const activeShare = act.total ? (act.month / act.total) * 100 : 0;
  const inactiveShare = act.total ? (act.inactive / act.total) * 100 : 0;

  const fixes = [
    { label: 'Anime without a banner', value: o.catalog.noBanner, of: o.catalog.anime, href: '/control/anime?missing=banner' },
    { label: 'Anime without a trailer', value: o.catalog.noTrailer, of: o.catalog.anime, href: '/control/anime?missing=trailer' },
    { label: 'Anime without a poster', value: o.catalog.noPoster, of: o.catalog.anime, href: '/control/anime?missing=poster' },
    { label: 'Anime without a synopsis', value: o.catalog.noSynopsis, of: o.catalog.anime, href: '/control/anime?missing=synopsis' },
    { label: 'Creators without a photo', value: o.people.noPhoto, of: o.people.total, href: '/control/people?missing=photo' },
    { label: 'Characters without an image', value: o.people.charactersNoImage, of: o.people.characters, href: '/control/characters?missing=image' },
    { label: 'Studios without a logo', value: o.studios.noLogo, of: o.studios.total, href: '/control/studios?missing=logo' },
  ].filter((f) => f.value > 0);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.kicker}>Control center</p>
        <h1 className={styles.title}>Dashboard</h1>
      </header>

      <nav className={styles.quick} aria-label="Quick actions">
        <Link href="/control/anime/new" className={styles.quickBtn}>
          <Film size={18} /> New anime
        </Link>
        <Link href="/control/news/new" className={styles.quickBtn}>
          <Newspaper size={18} /> Write news
        </Link>
        <Link href="/control/charts" className={styles.quickBtn}>
          <Trophy size={18} /> Charts
        </Link>
        <Link href="/control/choice" className={styles.quickBtn}>
          <CalendarHeart size={18} /> {todayPick ? `Today: ${todayPick.title}` : "Set today's pick"}
        </Link>
        <Link href="/control/collections/new" className={styles.quickBtn}>
          <Library size={18} /> New collection
        </Link>
        <Link href="/control/anime?missing=banner" className={styles.quickBtn}>
          <ImagePlus size={18} /> Fix images
        </Link>
      </nav>

      <section className={styles.block} aria-labelledby="d-accounts">
        <h2 id="d-accounts" className={styles.blockTitle}>
          Accounts
        </h2>
        <div className={styles.stats}>
          <Stat label="Total accounts" value={act.total} href="/control/users" />
          <Stat label="Active today" value={act.today} tone="good" href="/control/users?sort=active" />
          <Stat label="Active this week" value={act.week} note={`${pct(act.week, act.total)} of accounts`} />
          <Stat label="Active this month" value={act.month} note={`${pct(act.month, act.total)} of accounts`} />
          <Stat label="Not active (30+ days)" value={act.inactive} tone="warn" />
          <Stat label="Not seen yet" value={act.neverSeen} note="no visit since tracking began" />
        </div>
        <div className={styles.split} aria-label="Active vs not active">
          <span className={styles.splitActive} style={{ width: `${activeShare}%` }} />
          <span className={styles.splitInactive} style={{ width: `${inactiveShare}%` }} />
        </div>
        <p className={styles.caption}>
          Green: active in the last 30 days · amber: not active for 30+ days · grey: not seen yet. New this week: {fmt.format(o.users.new7d)} · creators:{' '}
          {fmt.format(o.users.creators)}.
        </p>
        <div className={styles.chart} aria-label="Sign-ups, last 14 days">
          {o.signups.map((d) => (
            <div key={d.day} className={styles.bar} title={`${d.day}: ${d.count}`}>
              <span style={{ height: `${Math.max(4, (d.count / maxSign) * 100)}%` }} data-zero={d.count === 0 || undefined} />
              <small>{d.day.slice(8)}</small>
            </div>
          ))}
        </div>
        <p className={styles.caption}>Sign-ups per day, last 14 days.</p>
      </section>

      <section className={styles.block} aria-labelledby="d-premiere">
        <h2 id="d-premiere" className={styles.blockTitle}>
          Premiering soon <small className={styles.countTag}>{premiering.length}</small>
        </h2>
        {premiering.length === 0 ? (
          <p className={styles.caption}>No dated premieres in the next 60 days.</p>
        ) : (
          <div className={styles.posterRail}>
            {premiering.map((a) => (
              <Link key={a.id} href={`/control/anime/${a.id}`} className={styles.posterCard}>
                <span className={styles.posterImg}>
                  {a.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.posterUrl} alt="" loading="lazy" />
                  ) : null}
                  <em className={styles.posterTag}>{untilText(a.at)}</em>
                </span>
                <strong>{a.title}</strong>
                <span>
                  {a.at ? dayFmt.format(new Date(a.at)) : ''} · {fmt.format(a.count)} hyped
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className={styles.block} aria-labelledby="d-air">
        <h2 id="d-air" className={styles.blockTitle}>
          On air now <small className={styles.countTag}>{airing.length}</small>
        </h2>
        {airing.length === 0 ? (
          <p className={styles.caption}>No scheduled episodes found.</p>
        ) : (
          <ul className={styles.airList}>
            {airing.map((a) => (
              <li key={a.id}>
                <Link href={`/control/anime/${a.id}`} className={styles.airRow}>
                  <span className={styles.pickerThumb}>
                    {a.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.posterUrl} alt="" loading="lazy" />
                    ) : null}
                  </span>
                  <span className={styles.rowText}>
                    <strong>{a.title}</strong>
                    <span>
                      Episode {a.episode} · {a.at ? timeFmt.format(new Date(a.at)) : ''} IST ({untilText(a.at)})
                    </span>
                  </span>
                  <span className={styles.rankCount}>
                    {fmt.format(a.count)} <small>raters</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.block} aria-labelledby="d-hot">
        <h2 id="d-hot" className={styles.blockTitle}>
          What members care about
        </h2>
        <div className={styles.panels}>
          <RankList title="Most hyped" items={hyped} unit="hyped" empty="No hype votes yet." chartHint />
          <RankList title="Most reviewed" items={reviewed} unit="reviews" extraUnit="in the last 30 days" empty="No reviews yet." chartHint />
          <RankList title="Most rated (episodes)" items={rated} unit="members" extraUnit="episode ratings" empty="No episode ratings yet." chartHint />
        </div>
      </section>

      {fixes.length > 0 && (
        <section className={styles.block} aria-labelledby="ov-fix">
          <h2 id="ov-fix" className={styles.blockTitle}>
            Fix next
          </h2>
          <div className={styles.fixGrid}>
            {fixes.map((f) => (
              <Link key={f.label} href={f.href} className={styles.fix}>
                <span className={styles.fixLabel}>{f.label}</span>
                <strong>{fmt.format(f.value)}</strong>
                <span className={styles.meter}>
                  <span style={{ width: `${Math.min(100, (f.value / Math.max(1, f.of)) * 100)}%` }} />
                </span>
                <span className={styles.fixGo}>
                  {pct(f.value, f.of)} of {fmt.format(f.of)} <ArrowRight size={14} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className={styles.block} aria-labelledby="ov-catalog">
        <h2 id="ov-catalog" className={styles.blockTitle}>
          Catalog & community
        </h2>
        <div className={styles.stats}>
          <Stat label="Anime" value={o.catalog.anime} href="/control/anime" />
          <Stat label="Airing" value={o.catalog.airing} />
          <Stat label="Upcoming" value={o.catalog.upcoming} />
          <Stat label="Creators & cast" value={o.people.total} href="/control/people" />
          <Stat label="Studios" value={o.studios.total} href="/control/studios" />
          <Stat label="Reviews" value={o.community.reviews} note={`${fmt.format(o.community.reviews7d)} this week`} href="/admin/reviews" />
          <Stat label="Episode ratings" value={o.community.episodeRatings} />
          <Stat label="Open reports" value={o.community.openReports} href="/admin/reviews" tone={o.community.openReports > 0 ? 'warn' : undefined} />
          <Stat label="News stories" value={o.news.total} note={`${fmt.format(o.news.last24h)} in the last 24h`} href="/control/news" />
          <Stat label="Articles" value={o.community.articles} href="/control/articles" />
          <Stat label="Communities" value={o.community.communities} />
        </div>
      </section>
    </div>
  );
}
