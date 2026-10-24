'use client';

/**
 * Creator dashboard (2026-10-24) — real counts, followers, owned
 * communities, creator reviews, recent activity, all from
 * GET /api/creator/dashboard and /api/creator/reviews. Lives inside the
 * creator's own profile (tab "Creator dashboard"); /creator only hosts
 * CreatorOnboarding (the explicit "turn on creator mode" step).
 */
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Settings, ExternalLink, Lock, Globe, PenLine, Trash2, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PageHead } from '../../components/ui/PageHead';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { FollowButton } from '../../components/social/FollowButton';
import styles from '../../app/creator/creator.module.css';

interface Dashboard {
  profile: { isCreator: boolean; channelName: string | null; channelUrl: string | null; creatorSince: string | null };
  stats: { followers: number; communities: number; members: number; publishedReviews: number; draftReviews: number };
  followers: {
    total: number;
    thisWeek: number;
    recent: Array<{ username: string; displayName: string | null; avatarUrl: string | null; followedAt: string; youFollowBack: boolean; isCreator?: boolean }>;
  };
  communities: Array<{ id: string; slug: string; name: string; description: string; visibility: string; membersOnly: boolean; memberCount: number; activeInvitations: number }>;
  activity: Array<{ kind: 'JOIN' | 'POST' | 'FOLLOW'; at: string; text: string; href: string }>;
}
interface ReviewRow {
  id: string;
  status: 'DRAFT' | 'PUBLISHED';
  title: string;
  score: number | null;
  spoilerLevel: string;
  anime: { slug: string; title: string; posterUrl: string | null };
  updatedAt: string;
}

type Tab = 'overview' | 'followers' | 'communities' | 'reviews';

export function CreatorOnboarding({ onDone }: { onDone: () => void }) {
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const [channelName, setChannelName] = useState('');
  const [channelUrl, setChannelUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/creator/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, channelUrl: channelUrl || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not turn on creator mode.');
      await refreshUser().catch(() => {});
      showToast('Creator mode is on', 'success');
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${styles.page} ${styles.narrow}`}>
      <PageHead kicker="Creator mode" title="Set up your creator account">
        Same OTAKUVA account, plus creator tools: members-only communities with invite keys, and Creator Reviews.
      </PageHead>
      <form className={`${styles.card} ${styles.form}`} onSubmit={submit}>
        {error && <div className={styles.error}>{error}</div>}
        <label className={styles.field}>
          <span className={styles.label}>Channel or creator name</span>
          <input className={styles.input} value={channelName} onChange={(e) => setChannelName(e.target.value)} maxLength={60} placeholder="e.g. Night Shift Anime" required />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Channel link (optional)</span>
          <input className={styles.input} value={channelUrl} onChange={(e) => setChannelUrl(e.target.value)} placeholder="https://youtube.com/@yourchannel" inputMode="url" />
        </label>
        <p className={styles.small}>
          This shows OTAKUVA members who you are. It isn&apos;t a verification badge — OTAKUVA doesn&apos;t verify channels.
        </p>
        <div className={styles.actionsRow}>
          <button type="submit" className={styles.btnPrimary} disabled={busy}>
            {busy ? 'Turning on…' : 'Turn on creator mode'}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * The creator dashboard. On its own page it has a big heading; embedded in
 * the creator's own profile (one place for both, owner 2026-10-24) the
 * profile header already shows name, channel and followers, so it keeps just
 * the actions, stats and tabs.
 */
export function CreatorDashboard({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<Dashboard | null>(null);
  const [notCreator, setNotCreator] = useState(false);
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const load = useCallback(async () => {
    const r = await fetch('/api/creator/dashboard', { cache: 'no-store' });
    if (r.status === 403) {
      setNotCreator(true);
      return;
    }
    if (r.ok) {
      setNotCreator(false);
      setData(await r.json());
      const rr = await fetch('/api/creator/reviews', { cache: 'no-store' });
      if (rr.ok) setReviews((await rr.json()).reviews);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return null;
  if (notCreator) return <CreatorOnboarding onDone={load} />;
  if (!data) return <p className={styles.muted}>Loading your dashboard…</p>;

  const removeReview = async (r: ReviewRow) => {
    if (!window.confirm(r.status === 'DRAFT' ? 'Delete this draft?' : 'Delete this published review?')) return;
    const res = await fetch(`/api/creator/reviews/${r.id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Deleted', 'success');
      load();
    } else showToast('Could not delete it.', 'error');
  };
  const deleteCommunity = async (c: Dashboard['communities'][number]) => {
    if (!window.confirm(`Delete "${c.name}"? Members lose access. This can't be undone from here.`)) return;
    const res = await fetch(`/api/communities/${encodeURIComponent(c.slug)}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Community deleted', 'success');
      load();
    } else showToast('Could not delete the community.', 'error');
  };

  const { stats } = data;
  const actions = (
    <>
      <Link href="/community/create" className={styles.btn}>
        <Plus size={15} aria-hidden="true" /> Community
      </Link>
      <Link href="/creator/reviews/new" className={styles.btnPrimary}>
        <PenLine size={15} aria-hidden="true" /> Write a review
      </Link>
    </>
  );
  return (
    <div className={embedded ? styles.embedded : styles.page}>
      {embedded ? (
        <div className={styles.embeddedHead}>
          <span className={styles.small}>Only you see this tab.</span>
          <div className={styles.actionsRow}>{actions}</div>
        </div>
      ) : (
      <PageHead
        kicker="Creator dashboard"
        title={data.profile.channelName || `@${user.username}`}
        actions={actions}
      >
        {data.profile.channelUrl ? (
          <a href={data.profile.channelUrl} target="_blank" rel="noopener noreferrer nofollow">
            {data.profile.channelUrl.replace(/^https:\/\//, '')} <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : (
          'Your communities, invitations and Creator Reviews.'
        )}
      </PageHead>
      )}

      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>
            Followers{data.followers.thisWeek > 0 && <span className={styles.statDelta}> · +{data.followers.thisWeek.toLocaleString('en-US')} this week</span>}
          </dt>
          <dd>{stats.followers.toLocaleString('en-US')}</dd>
        </div>
        {(
          [
            ['Communities', stats.communities],
            ['Members', stats.members],
            ['Published reviews', stats.publishedReviews],
            ['Drafts', stats.draftReviews],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className={styles.stat}>
            <dt>{label}</dt>
            <dd>{value.toLocaleString('en-US')}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.tabs} role="tablist">
        {(['overview', 'followers', 'communities', 'reviews'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`${styles.tab} ${tab === t ? styles.tabOn : ''}`} onClick={() => setTab(t)}>
            {t === 'overview' ? 'Overview' : t === 'followers' ? 'Followers' : t === 'communities' ? 'My communities' : 'My reviews'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Recent activity in your communities</h2>
          {data.activity.length === 0 ? (
            <p className={styles.muted}>Nothing yet — joins and new posts in your communities show up here.</p>
          ) : (
            <ul className={styles.list}>
              {data.activity.map((a, i) => (
                <li key={i} className={styles.row}>
                  <div className={styles.rowMain}>
                    <Link href={a.href} className={styles.rowTitle}>
                      {a.text}
                    </Link>
                    <span className={styles.small}>{new Date(a.at).toLocaleString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'followers' && (
        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <h2 className={styles.cardTitle}>
              {data.followers.total.toLocaleString('en-US')} follower{data.followers.total === 1 ? '' : 's'}
            </h2>
            <Link href={`/profile/${encodeURIComponent(user.username)}`} className={`${styles.btn} ${styles.btnSm}`}>
              See all on your profile
            </Link>
          </div>
          {data.followers.recent.length === 0 ? (
            <p className={styles.muted}>
              No followers yet. When people follow you they get a notification each time you review, rate, publish a collection or
              article, or get hyped for an anime.
            </p>
          ) : (
            <ul className={styles.list}>
              {data.followers.recent.map((f) => (
                <li key={f.username} className={styles.row}>
                  <UserAvatar username={f.displayName || f.username} avatarUrl={f.avatarUrl} size={40} />
                  <div className={styles.rowMain}>
                    <Link href={`/profile/${encodeURIComponent(f.username)}`} className={styles.rowTitle}>
                      {f.displayName || `@${f.username}`}
                      {f.isCreator && <span className={`${styles.pill} ${styles.pillStrong}`} style={{ marginLeft: 8 }}>Creator</span>}
                    </Link>
                    <span className={styles.small}>
                      @{f.username} · followed {new Date(f.followedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <FollowButton username={f.username} following={f.youFollowBack} followsYou size="sm" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'communities' && (
        <section className={styles.card}>
          {data.communities.length === 0 ? (
            <div className={styles.empty}>
              <p>You don&apos;t own a community yet.</p>
              <Link href="/community/create" className={styles.btnPrimary}>
                <Plus size={15} aria-hidden="true" /> Create one
              </Link>
            </div>
          ) : (
            <ul className={styles.list}>
              {data.communities.map((c) => (
                <li key={c.id} className={styles.row}>
                  <span className={styles.mark} aria-hidden="true">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  <div className={styles.rowMain}>
                    <Link href={`/community/${c.slug}`} className={styles.rowTitle}>
                      {c.name}
                    </Link>
                    <span className={styles.small}>
                      <span className={`${styles.pill} ${c.membersOnly ? styles.pillStrong : ''}`}>
                        {c.membersOnly ? <Lock size={11} aria-hidden="true" /> : <Globe size={11} aria-hidden="true" />}
                        {c.membersOnly ? 'Members-only' : c.visibility === 'REQUEST_TO_JOIN' ? 'Request to join' : 'Public'}
                      </span>{' '}
                      {c.memberCount.toLocaleString('en-US')} member{c.memberCount === 1 ? '' : 's'}
                      {c.membersOnly && ` · ${c.activeInvitations} active invitation${c.activeInvitations === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    <Link href={`/creator/communities/${c.slug}`} className={`${styles.btn} ${styles.btnSm}`}>
                      <Settings size={14} aria-hidden="true" /> Manage
                    </Link>
                    <button type="button" className={`${styles.btnDanger} ${styles.btnSm}`} onClick={() => deleteCommunity(c)}>
                      <Trash2 size={14} aria-hidden="true" /> Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'reviews' && (
        <section className={styles.card}>
          {!reviews || reviews.length === 0 ? (
            <div className={styles.empty}>
              <p>No Creator Reviews yet.</p>
              <Link href="/creator/reviews/new" className={styles.btnPrimary}>
                <PenLine size={15} aria-hidden="true" /> Write your first
              </Link>
            </div>
          ) : (
            <ul className={styles.list}>
              {reviews.map((r) => (
                <li key={r.id} className={styles.row}>
                  <span className={styles.poster}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.anime.posterUrl && <img src={r.anime.posterUrl} alt="" loading="lazy" />}
                  </span>
                  <div className={styles.rowMain}>
                    <span className={styles.rowTitle}>{r.title}</span>
                    <span className={styles.small}>
                      <span className={`${styles.pill} ${r.status === 'PUBLISHED' ? styles.pillGood : ''}`}>{r.status === 'PUBLISHED' ? 'Published' : 'Draft'}</span>{' '}
                      {r.anime.title}
                      {r.score != null && ` · ★ ${r.score.toFixed(1)}`} · {new Date(r.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    {r.status === 'PUBLISHED' && (
                      <Link href={`/anime/${r.anime.slug}#reviews`} className={`${styles.btn} ${styles.btnSm}`}>
                        <Eye size={14} aria-hidden="true" /> View as readers see it
                      </Link>
                    )}
                    <Link href={`/creator/reviews/${r.id}`} className={`${styles.btn} ${styles.btnSm}`}>
                      <PenLine size={14} aria-hidden="true" /> Edit
                    </Link>
                    <button type="button" className={`${styles.btnDanger} ${styles.btnSm}`} onClick={() => removeReview(r)}>
                      <Trash2 size={14} aria-hidden="true" /> Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
