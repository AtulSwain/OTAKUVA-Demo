'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Bookmark, ChevronRight, Flag, Share2, ThumbsUp } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { SpoilerBlock } from '../../../components/community/SpoilerBlock';
import { CommentsSection } from '../../../components/community/comments/CommentsSection';
import { ReportDialog } from '../../../components/community/comments/ReportDialog';
import { UserAvatar } from '../../../components/ui/UserAvatar';
import { relativeTime } from '../../../lib/format/relativeTime';
import styles from './discussionDetail.module.css';

interface DiscussionDetail {
  id: string;
  title: string;
  body: string;
  type: string;
  spoilerLevel: string;
  status: string;
  replyCount: number;
  helpfulCount: number;
  followerCount: number;
  createdAt: string;
  isFollowed?: boolean;
  hasReacted?: boolean;
  commentBlockedReason?: string | null;
  author: { id: string; username: string; avatarUrl?: string | null };
  anime?: { id: string; canonicalTitle: string; slug: string; posterUrl: string } | null;
  episode?: { id: string; number: number; title?: string | null; airedAt?: string | null } | null;
  community?: { name: string; slug: string; rules?: { id: string; title: string; content: string }[] } | null;
  channel?: { name: string; slug: string } | null;
}

interface RelatedItem {
  id: string;
  title: string;
  replyCount: number;
}

// Shown only where a thread isn't inside a community with its own rules.
const PLATFORM_GUIDELINES = [
  'Be kind — disagree with ideas, not people.',
  'Mark spoilers, including in images and GIFs.',
  'Stay on topic for this anime or episode.',
  'No links to unofficial streams or piracy.',
];

const TYPE_LABELS: Record<string, string> = {
  GENERAL: 'Discussion',
  QUESTION: 'Question',
  THEORY: 'Theory',
  REACTION: 'Reaction',
  RECOMMENDATION: 'Recommendation',
  ANALYSIS: 'Analysis',
  EPISODE_DISCUSSION: 'Episode discussion',
};

export default function DiscussionDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();

  const [discussion, setDiscussion] = useState<DiscussionDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'notFound' | 'forbidden' | 'error'>('loading');
  const [related, setRelated] = useState<RelatedItem[]>([]);
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/discussions/${id}`, { cache: 'no-store' });
      if (res.status === 404) return setStatus('notFound');
      if (res.status === 403) return setStatus('forbidden');
      if (!res.ok) return setStatus('error');
      const data = await res.json();
      setDiscussion(data.discussion);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [id]);

  // Re-fetch when the viewer changes: follow/helpful state and whether they
  // may comment are per viewer.
  useEffect(() => {
    if (id) load();
  }, [id, load, user?.id]);

  useEffect(() => {
    const animeId = discussion?.anime?.id;
    if (!animeId) return;
    let cancelled = false;
    fetch(`/api/discussions?animeId=${encodeURIComponent(animeId)}&limit=6&sort=popular`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setRelated(
          (data.discussions || [])
            .filter((d: any) => d.id !== discussion?.id)
            .slice(0, 5)
            .map((d: any) => ({ id: d.id, title: d.title, replyCount: d.replyCount ?? 0 }))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [discussion?.anime?.id, discussion?.id]);

  const toggle = async (kind: 'reactions' | 'follow') => {
    if (!user) return openAuthModal('login');
    try {
      const res = await fetch(`/api/discussions/${id}/${kind}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setDiscussion((prev) =>
        prev
          ? kind === 'reactions'
            ? { ...prev, hasReacted: data.hasReacted, helpfulCount: data.helpfulCount }
            : { ...prev, isFollowed: data.isFollowed, followerCount: data.followerCount }
          : prev
      );
    } catch (e: any) {
      showToast(e.message || 'Something went wrong', 'error');
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: discussion?.title, url });
      else {
        await navigator.clipboard.writeText(url);
        showToast('Link copied', 'success');
      }
    } catch {
      // share sheet dismissed
    }
  };

  if (status === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonBody} />
      </div>
    );
  }

  if (status !== 'ready' || !discussion) {
    const copy = {
      notFound: ['Discussion not found', 'It may have been removed.'],
      forbidden: ['Members only', 'This discussion is in a private community.'],
      error: ['Couldn’t load this discussion', 'Check your connection and try again.'],
    }[status as 'notFound' | 'forbidden' | 'error'];
    return (
      <div className={`${styles.page} ${styles.stateBox}`}>
        <h1 className={styles.stateTitle}>{copy[0]}</h1>
        <p className={styles.stateText}>{copy[1]}</p>
        {status === 'error' ? (
          <button type="button" className={styles.stateAction} onClick={load}>Try again</button>
        ) : (
          <Link href="/community" className={styles.stateAction}>Browse communities</Link>
        )}
      </div>
    );
  }

  const d = discussion;
  const episodeLabel = d.episode ? `Episode ${d.episode.number}${d.episode.title ? ` · ${d.episode.title}` : ''}` : null;
  const guidelines = d.community?.rules?.length
    ? d.community.rules.map((r) => `${r.title}${r.content ? ` — ${r.content}` : ''}`)
    : PLATFORM_GUIDELINES;
  const spoilerLevel = d.episode ? 'EPISODE_SPOILER' : 'ANIME_SPOILER';

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <ol>
          {d.community ? (
            <li><Link href={`/community/${d.community.slug}`}>{d.community.name}</Link></li>
          ) : (
            <li><Link href="/discussions">Discussions</Link></li>
          )}
          {d.anime && (
            <li>
              <ChevronRight size={12} aria-hidden="true" />
              <Link href={`/anime/${d.anime.slug}`}>{d.anime.canonicalTitle}</Link>
            </li>
          )}
          {episodeLabel && (
            <li className={styles.crumbCurrent}>
              <ChevronRight size={12} aria-hidden="true" />
              <span>Ep {d.episode!.number}</span>
            </li>
          )}
        </ol>
      </nav>

      <div className={styles.layout}>
        <main className={styles.main}>
          <header className={styles.header}>
            <div className={styles.kicker}>
              <span>{TYPE_LABELS[d.type] || 'Discussion'}</span>
              {d.status === 'LOCKED' && <span className={styles.lockedTag}>Locked</span>}
            </div>
            <h1 className={styles.title}>{d.title}</h1>
            <div className={styles.byline}>
              <UserAvatar username={d.author.username} avatarUrl={d.author.avatarUrl} size={22} />
              <Link href={`/profile/${encodeURIComponent(d.author.username)}`} className={styles.bylineName}>
                {d.author.username}
              </Link>
              <span aria-hidden="true">·</span>
              <time dateTime={d.createdAt} title={new Date(d.createdAt).toLocaleString()}>{relativeTime(d.createdAt, Date.now(), true)}</time>
            </div>
          </header>

          {d.anime && (
            <Link href={`/anime/${d.anime.slug}`} className={styles.context}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {d.anime.posterUrl && <img src={d.anime.posterUrl} alt="" className={styles.contextPoster} />}
              <span className={styles.contextText}>
                <strong>{d.anime.canonicalTitle}</strong>
                {episodeLabel && <span>{episodeLabel}</span>}
              </span>
            </Link>
          )}

          <SpoilerBlock spoilerLevel={d.spoilerLevel} animeSlug={d.anime?.slug} episodeNumber={d.episode?.number}>
            <div className={styles.body}>
              {d.body.split('\n').map((para, i) => (para.trim() ? <p key={i}>{para}</p> : null))}
            </div>
          </SpoilerBlock>

          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.action} ${d.hasReacted ? styles.actionActive : ''}`}
              onClick={() => toggle('reactions')}
              aria-pressed={Boolean(d.hasReacted)}
            >
              <ThumbsUp size={14} aria-hidden="true" />
              <span>Helpful{d.helpfulCount > 0 ? ` · ${d.helpfulCount}` : ''}</span>
            </button>
            <button
              type="button"
              className={`${styles.action} ${d.isFollowed ? styles.actionActive : ''}`}
              onClick={() => toggle('follow')}
              aria-pressed={Boolean(d.isFollowed)}
            >
              <Bookmark size={14} fill={d.isFollowed ? 'currentColor' : 'none'} aria-hidden="true" />
              <span>{d.isFollowed ? 'Following' : 'Follow'}</span>
            </button>
            <button type="button" className={styles.action} onClick={share}>
              <Share2 size={14} aria-hidden="true" />
              <span>Share</span>
            </button>
            <button
              type="button"
              className={`${styles.action} ${styles.actionEnd}`}
              onClick={() => (user ? setReporting(true) : openAuthModal('login'))}
              aria-label="Report discussion"
            >
              <Flag size={14} aria-hidden="true" />
              <span className={styles.hideOnPhone}>Report</span>
            </button>
          </div>

          <CommentsSection
            discussionId={d.id}
            animeSlug={d.anime?.slug}
            initialCount={d.replyCount}
            blockedReason={d.commentBlockedReason ?? null}
            spoilerLevel={spoilerLevel}
          />
        </main>

        {/* Desktop only: tablets and phones drop the sidebar. */}
        <aside className={styles.sidebar} aria-label="About this discussion">
          {d.anime && (
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>{d.episode ? 'Episode' : 'Anime'}</h2>
              <Link href={`/anime/${d.anime.slug}`} className={styles.panelAnime}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {d.anime.posterUrl && <img src={d.anime.posterUrl} alt="" />}
                <span>
                  <strong>{d.anime.canonicalTitle}</strong>
                  {d.episode && <span>Episode {d.episode.number}{d.episode.title ? ` — ${d.episode.title}` : ''}</span>}
                  {d.episode?.airedAt && (
                    <span className={styles.muted}>
                      Aired {new Date(d.episode.airedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </span>
              </Link>
            </section>
          )}

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>{d.community?.rules?.length ? 'Community rules' : 'Guidelines'}</h2>
            <ul className={styles.guidelines}>
              {guidelines.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </section>

          {related.length > 0 && (
            <section className={styles.panel}>
              <h2 className={styles.panelTitle}>More about {d.anime?.canonicalTitle}</h2>
              <ul className={styles.related}>
                {related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/discussions/${r.id}`}>{r.title}</Link>
                    <span className={styles.muted}>{r.replyCount} {r.replyCount === 1 ? 'reply' : 'replies'}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {reporting && <ReportDialog targetType="DISCUSSION" targetId={d.id} onClose={() => setReporting(false)} />}
    </div>
  );
}
