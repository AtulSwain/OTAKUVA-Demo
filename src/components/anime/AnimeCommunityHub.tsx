'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Heart, MessageCircle, MessageSquarePlus, PenLine, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { UserAvatar } from '../ui/UserAvatar';
import { resolveMediaUrl } from '../../lib/mediaResolver';
import styles from './AnimeCommunityHub.module.css';

interface Thread {
  id: string;
  title: string;
  type: string;
  spoilerLevel: string;
  replyCount: number;
  createdAt: string;
  author: { username: string; avatarUrl: string | null } | null;
  community: { name: string; slug: string } | null;
  anime: { slug: string; title: string } | null;
}
interface HubCommunity {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  description: string;
  memberCount: number;
  reason: 'anime' | 'genre' | 'similar';
  sharedGenres: string[];
  about: { slug: string; title: string } | null;
  membershipStatus: string | null;
}
interface Hub {
  anime: { id: string; slug: string; title: string; genres: string[]; genreLinks: { name: string; slug: string }[] };
  discussions: Thread[];
  discussionCount: number;
  sameGenre: Thread[];
  communities: HubCommunity[];
  communityTotal: number;
  articles: { id: string; slug: string; title: string; summary: string; coverImageUrl: string | null; createdAt: string; author: { username: string; avatarUrl: string | null }; likeCount: number; commentCount: number }[];
  articleCount: number;
}

const TYPES = [
  ['GENERAL', 'General'],
  ['QUESTION', 'Question'],
  ['THEORY', 'Theory'],
  ['REACTION', 'Reaction'],
  ['ANALYSIS', 'Analysis'],
  ['RECOMMENDATION', 'Recommendation'],
] as const;
const TYPE_LABEL: Record<string, string> = Object.fromEntries([...TYPES, ['EPISODE_DISCUSSION', 'Episode']]);

const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return rtf.format(-Math.max(mins, 0), 'minute');
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return rtf.format(-hrs, 'hour');
  const days = Math.round(hrs / 24);
  if (days < 30) return rtf.format(-days, 'day');
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
const compact = new Intl.NumberFormat('en-US', { notation: 'compact' });

function ThreadRow({ t, showAnime }: { t: Thread; showAnime?: boolean }) {
  const where = t.community ? t.community.name : 'Public';
  return (
    <li>
      <Link href={`/discussions/${t.id}`} className={styles.thread}>
        <UserAvatar username={t.author?.username} avatarUrl={t.author?.avatarUrl} size={34} />
        <span className={styles.threadMain}>
          <span className={styles.threadTags}>
            <span className={styles.tag}>{TYPE_LABEL[t.type] || 'General'}</span>
            {t.spoilerLevel !== 'NO_SPOILER' && <span className={`${styles.tag} ${styles.spoiler}`}>Spoilers</span>}
          </span>
          <strong>{t.title}</strong>
          <span className={styles.threadMeta}>
            {[t.author ? `@${t.author.username}` : null, showAnime && t.anime ? t.anime.title : where, ago(t.createdAt)].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className={styles.replies} aria-label={`${t.replyCount} replies`}>
          <MessageCircle size={14} aria-hidden="true" /> {compact.format(t.replyCount)}
        </span>
      </Link>
    </li>
  );
}

/** Bottom-of-page community section for one anime. */
export function AnimeCommunityHub({ animeId, animeTitle }: { animeId: string; animeTitle: string }) {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [hub, setHub] = useState<Hub | null>(null);
  const [failed, setFailed] = useState(false);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('GENERAL');
  const [spoilers, setSpoilers] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/anime/${encodeURIComponent(animeId)}/community`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Hub) => { setHub(d); setFailed(false); })
      .catch(() => setFailed(true));
  }, [animeId]);

  useEffect(() => { load(); }, [load, user?.id]);

  const startDiscussion = () => {
    if (!user) return openAuthModal('login');
    setComposing(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hub || posting) return;
    setPosting(true);
    try {
      const res = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), type, spoilerLevel: spoilers ? 'ANIME_SPOILER' : 'NO_SPOILER', animeId: hub.anime.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not start the discussion.');
      setTitle('');
      setBody('');
      setSpoilers(false);
      setComposing(false);
      showToast('Discussion posted', 'success');
      // The page no longer lists this anime's threads (owner, 2026-10-22), so
      // open the new one.
      if (data.discussion?.id) router.push(`/discussions/${data.discussion.id}`);
      else load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setPosting(false);
    }
  };

  if (failed && !hub) {
    return (
      <div className={styles.hub}>
        <h2 className={styles.heading}>Discussion</h2>
        <p className={styles.muted}>The discussion section couldn&apos;t load. <button type="button" className={styles.linkBtn} onClick={load}>Try again</button></p>
      </div>
    );
  }

  return (
    <div className={styles.hub}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.heading}>Discussion</h2>
          <p className={styles.muted}>Talk about {animeTitle} with other fans.</p>
        </div>
        <button type="button" className={styles.primary} onClick={startDiscussion}>
          <MessageSquarePlus size={16} aria-hidden="true" /> Start a discussion
        </button>
      </div>

      {composing && (
        <form className={styles.composer} onSubmit={submit}>
          <div className={styles.composerHead}>
            <strong>New discussion about {animeTitle}</strong>
            <button type="button" className={styles.iconBtn} onClick={() => setComposing(false)} aria-label="Cancel">
              <X size={16} />
            </button>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 200))} placeholder="Title (at least 5 characters)" aria-label="Discussion title" required minLength={5} />
          <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 10000))} placeholder="What do you want to talk about? (at least 10 characters)" rows={4} aria-label="Discussion text" required minLength={10} />
          <div className={styles.composerRow}>
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Discussion type">
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label className={styles.check}>
              <input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} /> Contains spoilers
            </label>
            <button type="submit" className={styles.primary} disabled={posting || title.trim().length < 5 || body.trim().length < 10}>
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      )}

      {!hub ? (
        <p className={styles.muted}>Loading discussion…</p>
      ) : (
        <>
          {hub.sameGenre.length > 0 && (
            <section className={styles.block} aria-labelledby="hub-genre">
              <div className={styles.blockHead}>
                <h3 id="hub-genre">More {hub.anime.genres.slice(0, 2).join(' & ')} talk</h3>
                <Link href="/discussions" className={styles.more}>All discussions <ChevronRight size={14} aria-hidden="true" /></Link>
              </div>
              <ul className={styles.threads}>{hub.sameGenre.map((t) => <ThreadRow key={t.id} t={t} showAnime />)}</ul>
            </section>
          )}

          <section className={styles.block} aria-labelledby="hub-articles">
            <div className={styles.blockHead}>
              <h3 id="hub-articles">Member articles{hub.articleCount > 0 && <span className={styles.count}>{hub.articleCount}</span>}</h3>
              <Link href={`/articles/new?anime=${encodeURIComponent(hub.anime.slug)}`} className={styles.more}>
                <PenLine size={14} aria-hidden="true" /> Write one
              </Link>
            </div>
            {hub.articles.length > 0 ? (
              <div className={styles.articleGrid}>
                {hub.articles.map((a) => (
                  <Link key={a.id} href={`/articles/${a.slug}`} className={styles.article}>
                    {a.coverImageUrl && (
                      <span className={styles.articleCover}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={resolveMediaUrl(a.coverImageUrl) || undefined} alt="" loading="lazy" />
                      </span>
                    )}
                    <span className={styles.articleText}>
                      <strong>{a.title}</strong>
                      {a.summary && <span className={styles.articleSummary}>{a.summary}</span>}
                      <span className={styles.articleMeta}>
                        <span>@{a.author.username}</span>
                        <span className={styles.stat}><Heart size={13} aria-hidden="true" /> {a.likeCount}</span>
                        <span className={styles.stat}><MessageCircle size={13} aria-hidden="true" /> {a.commentCount}</span>
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className={styles.empty}>No member articles about {animeTitle} yet. Found news or something worth sharing? Write it up.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
