import React from 'react';
import Link from 'next/link';
import { getAuthUserFromCookies } from '@/lib/auth';
import { activityFeed, adminAlerts, listCommunities, listCreators, listDiscussions, platformTotals } from '@control/lib/platform';
import { KpiGrid } from '../Charts';
import styles from '../control.module.css';
import { CreatorRecovery } from './CreatorRecovery';

const fmt = new Intl.NumberFormat('en-US');
const when = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const KINDS: [string, string][] = [
  ['', 'Everything'],
  ['signup', 'Sign-ups'],
  ['creator', 'New creators'],
  ['review', 'Reviews'],
  ['rating', 'Episode ratings'],
  ['hype', 'Hype'],
  ['library', 'Library'],
  ['collection', 'Collections'],
  ['article', 'Articles'],
  ['discussion', 'Discussions'],
  ['follow', 'Follows'],
  ['community', 'Community joins'],
];
const KIND_LABEL = Object.fromEntries(KINDS) as Record<string, string>;

function Head({ kicker, title, children }: { kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <header className={styles.head}>
      <p className={styles.kicker}>{kicker}</p>
      <h1 className={styles.title}>{title}</h1>
      {children}
    </header>
  );
}

function Feed({ items }: { items: Awaited<ReturnType<typeof activityFeed>> }) {
  if (!items.length) return <p className={styles.caption}>Nothing yet.</p>;
  return (
    <ul className={styles.list}>
      {items.map((f, i) => (
        <li key={`${f.at}-${i}`} className={styles.userRow}>
          <span className={styles.badge}>{KIND_LABEL[f.kind] || f.kind}</span>
          <span className={styles.rowText}>
            <strong>
              <Link href={`/profile/${f.who}`} target="_blank" className={styles.inlineLink}>
                @{f.who}
              </Link>{' '}
              {f.href ? (
                <Link href={f.href} target="_blank" className={styles.inlineLink}>
                  {f.text}
                </Link>
              ) : (
                f.text
              )}
            </strong>
            <span>{when.format(new Date(f.at))} IST</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The owner's main desk: everything across all accounts at a glance. */
export async function MainDeskPage() {
  const me = await getAuthUserFromCookies();
  const [t, alerts, feed] = await Promise.all([platformTotals(), me ? adminAlerts(me.id) : Promise.resolve([]), activityFeed(30)]);
  return (
    <div className={styles.page}>
      <Head kicker="Platform" title="Main desk" />
      <KpiGrid
        items={[
          { label: 'Members', value: t.members },
          { label: 'Creators', value: t.creators, tone: 'good' },
          { label: 'Communities', value: t.communities },
          { label: 'Discussions', value: t.discussions, note: `${fmt.format(t.replies)} replies` },
          { label: 'Reviews', value: t.reviews },
          { label: 'Episode ratings', value: t.ratings },
          { label: 'Library entries', value: t.library },
          { label: 'Collections', value: t.collections },
          { label: 'Articles', value: t.articles },
          { label: 'Follows', value: t.follows },
          { label: 'Hype votes', value: t.hype },
          { label: 'Anime', value: t.anime },
        ]}
      />
      <section className={styles.block}>
        <div className={styles.panels}>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h3>Alerts</h3>
            </div>
            {alerts.length === 0 ? (
              <p className={styles.caption}>New members and new creators will show up here (and in your bell).</p>
            ) : (
              <ul className={styles.list}>
                {alerts.map((a) => (
                  <li key={a.id}>
                    <Link href={a.linkUrl || '/control'} className={styles.rowBtn}>
                      <span className={styles.rowText}>
                        <strong>
                          {a.title} {!a.isRead && <em className={styles.live}>new</em>}
                        </strong>
                        <span>
                          {a.body} · {ago(a.createdAt.toISOString())}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h3>Jump to</h3>
            </div>
            <div className={styles.chipWrap}>
              {[
                ['/control/creators', 'All creators'],
                ['/control/communities', 'Communities & discussions'],
                ['/control/activity', 'Activity feed'],
                ['/control/users', 'All members'],
                ['/control/analytics/members', 'Member analytics'],
                ['/control/analytics/community', 'Community analytics'],
              ].map(([href, label]) => (
                <Link key={href} href={href} className={styles.chip} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className={styles.block}>
        <h2 className={styles.blockTitle}>
          Latest activity{' '}
          <Link href="/control/activity" className={styles.inlineLink} style={{ fontSize: 13 }}>
            see all
          </Link>
        </h2>
        <Feed items={feed} />
      </section>
    </div>
  );
}

/** Every creator on the platform with what they've done. */
export async function CreatorsDeskPage() {
  const creators = await listCreators();
  return (
    <div className={styles.page}>
      <Head kicker="Platform" title={`Creators (${creators.length})`} />
      {creators.length === 0 ? (
        <p className={styles.caption}>No creators yet.</p>
      ) : (
        <ul className={styles.list}>
          {creators.map((c) => (
            <li key={c.id} className={styles.userRow}>
              <span className={styles.avatar}>
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatarUrl.replace('https://media.otakuva.com/', '/api/media/')} alt="" />
                ) : (
                  c.username[0]?.toUpperCase()
                )}
              </span>
              <span className={styles.rowText}>
                <Link href={`/profile/${c.username}`} target="_blank" className={styles.cardName}>
                  {c.displayName || c.username} <small>@{c.username}</small>
                </Link>
                <span>
                  {c.channel || 'No channel name'}
                  {c.channelUrl && (
                    <>
                      {' · '}
                      <a href={c.channelUrl} target="_blank" rel="noopener noreferrer" className={styles.inlineLink}>
                        channel
                      </a>
                    </>
                  )}{' '}
                  · creator since {c.since ? day.format(new Date(c.since)) : '—'} · last seen {ago(c.lastSeenAt)}
                </span>
                <span className={styles.tags}>
                  <em className={styles.live}>{fmt.format(c.followers)} follower{c.followers === 1 ? '' : 's'}</em>
                  <em className={styles.badge}>{c.reviews} reviews ({c.creatorReviews} creator)</em>
                  <em className={styles.badge}>{c.rated} anime rated</em>
                  <em className={styles.badge}>{c.hyped} hyped</em>
                  <em className={styles.badge}>{c.communities} communities</em>
                  <em className={styles.badge}>{c.articles} articles</em>
                </span>
                <CreatorRecovery id={c.id} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Every community and the latest discussions. */
export async function CommunitiesDeskPage({ q }: { q: string }) {
  const [communities, discussions] = await Promise.all([listCommunities(), listDiscussions(q)]);
  return (
    <div className={styles.page}>
      <Head kicker="Platform" title="Communities & discussions" />
      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Communities ({communities.length})</h2>
        <ul className={styles.list}>
          {communities.length === 0 && <li className={styles.caption}>No communities yet.</li>}
          {communities.map((c) => (
            <li key={c.id}>
              <Link href={`/control/communities/${c.id}`} className={styles.rowBtn}>
                <span className={styles.rowText}>
                  <strong>{c.name}</strong>
                  <span>
                    by @{c.owner} · created {c.createdAt ? day.format(new Date(c.createdAt)) : ''}
                    {c.anime ? ` · about ${c.anime}` : ''}
                  </span>
                  <span className={styles.tags}>
                    <em className={styles.live}>{fmt.format(c.members)} members</em>
                    <em className={styles.badge}>{c.discussions} discussions</em>
                    <em className={styles.badge}>{c.visibility.toLowerCase()}</em>
                    <em className={styles.badge}>{c.type.toLowerCase()}</em>
                    {c.status !== 'ACTIVE' && <em className={styles.miss}>{c.status.toLowerCase()}</em>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.block}>
        <h2 className={styles.blockTitle}>Discussions ({discussions.length}{discussions.length === 150 ? '+' : ''})</h2>
        <form className={styles.toolbar} action="/control/communities">
          <label className={styles.search}>
            <input name="q" defaultValue={q} placeholder="Search discussion titles" aria-label="Search discussion titles" />
          </label>
        </form>
        <ul className={styles.list}>
          {discussions.length === 0 && <li className={styles.caption}>No discussions{q ? ' match that search' : ' yet'}.</li>}
          {discussions.map((d) => (
            <li key={d.id}>
                <Link href={`/control/discussions/${d.id}`} className={styles.rowBtn}>
                <span className={styles.rowText}>
                  <strong>{d.title}</strong>
                  <span>
                    by @{d.author}
                    {d.community ? ` in ${d.community}` : ''}
                    {d.anime ? ` · ${d.anime}` : ''} · {d.createdAt ? when.format(new Date(d.createdAt)) : ''}
                  </span>
                  <span className={styles.tags}>
                    <em className={styles.badge}>{d.replies} replies</em>
                    {d.status !== 'PUBLISHED' && d.status !== 'ACTIVE' && <em className={styles.miss}>{d.status.toLowerCase()}</em>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Everything happening across all accounts, newest first. */
export async function ActivityDeskPage({ kind }: { kind: string }) {
  const k = KINDS.some(([v]) => v === kind) ? kind : '';
  const items = await activityFeed(200, k);
  return (
    <div className={styles.page}>
      <Head kicker="Platform" title="Activity feed">
        <div className={styles.chipWrap} style={{ marginTop: 12 }}>
          {KINDS.map(([v, label]) => (
            <Link key={v || 'all'} href={v ? `/control/activity?kind=${v}` : '/control/activity'} className={k === v ? styles.chipOn : styles.chip} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
              {label}
            </Link>
          ))}
        </div>
      </Head>
      <p className={styles.caption}>Latest {items.length} — every account, newest first.</p>
      <Feed items={items} />
    </div>
  );
}
