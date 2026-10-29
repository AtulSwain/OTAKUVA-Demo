'use client';

/**
 * Homepage "Content creators" (2026-10-24, owner; sits right above
 * "Creators and Directors"): story-style circles for every creator account —
 * the ones the viewer follows first ("The creators you follow"), then the
 * most followed (a bright ring = active in the last 7 days), then a short feed of what creators recently rated, reviewed or
 * got hyped for. Real data from GET /api/creators; renders nothing until
 * there is at least one creator.
 */
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { HypeIcon } from '../hype/HypeMeter';
import { PeakedAt } from '../rating/PeakedAt';
import { SectionHead } from '../ui/SectionHead';
import { AnimeImage } from '../anime/AnimeImage';
import { avatarInitial } from '../../lib/mediaResolver';
import { useAuth } from '../../context/AuthContext';
import styles from './CreatorsSpotlight.module.css';

interface CreatorCard {
  username: string;
  displayName: string | null;
  channelName: string | null;
  avatarUrl: string | null;
  followerCount: number;
  lastActiveAt: string | null;
}
interface FeedItem {
  kind: 'RATED' | 'REVIEWED' | 'HYPED';
  at: string;
  creator: { username: string; name: string; avatarUrl: string | null };
  anime: { id?: string; slug: string; title: string; posterUrl: string | null };
  score: number | null;
  review: { id: string; title: string } | null;
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function Circle({ c, now, following }: { c: CreatorCard; now: number; following: boolean }) {
  const fresh = c.lastActiveAt ? now - new Date(c.lastActiveAt).getTime() < WEEK_MS : false;
  const name = c.channelName || c.displayName || c.username;
  return (
    <Link href={`/profile/${encodeURIComponent(c.username)}`} className={styles.circleLink} title={`${name} · @${c.username}`}>
      <span className={`${styles.ring} ${fresh ? styles.ringFresh : ''}`}>
        <span className={styles.avatar}>
          {c.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.avatarUrl} alt="" loading="lazy" decoding="async" />
          ) : (
            <span aria-hidden="true">{avatarInitial(name)}</span>
          )}
        </span>
      </span>
      <span className={styles.circleName}>{name}</span>
      {following && <span className={styles.followingTag}>Following</span>}
      <span className={styles.circleMeta}>
        {compact.format(c.followerCount)} {c.followerCount === 1 ? 'follower' : 'followers'}
      </span>
    </Link>
  );
}

function verb(item: FeedItem) {
  if (item.kind === 'REVIEWED') return 'reviewed';
  if (item.kind === 'HYPED') return 'is hyped for';
  return 'rated';
}

export function CreatorsSpotlight() {
  const { user } = useAuth();
  const [data, setData] = useState<{ creators: CreatorCard[]; feed: FeedItem[] } | null>(null);
  const [now, setNow] = useState(0);
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  // Signed in: who the viewer follows, so their creators come first.
  useEffect(() => {
    if (!user) {
      setFollowed(new Set());
      return;
    }
    fetch(`/api/users/${encodeURIComponent(user.username)}/following?limit=60`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFollowed(new Set((d.items || []).map((i: { username: string }) => i.username))))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    setNow(Date.now());
    fetch('/api/creators?limit=24&feed=8')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  }, []);

  if (!data || data.creators.length === 0) return null;
  const followsAny = data.creators.some((c) => followed.has(c.username));
  const creators = [...data.creators].sort((a, b) => Number(followed.has(b.username)) - Number(followed.has(a.username)));

  return (
    <section className={styles.block} aria-labelledby="creators-spotlight">
      <SectionHead kicker="Content creators" title={followsAny ? 'The creators you follow' : 'Creators to follow'} id="creators-spotlight" />
      <ul className={styles.circles}>
        {creators.map((c) => (
          <li key={c.username}>
            <Circle c={c} now={now} following={followed.has(c.username)} />
          </li>
        ))}
      </ul>

      {data.feed.length > 0 && (
        <ul className={styles.feed}>
          {data.feed.map((item, i) => (
            <li key={`${item.kind}-${item.creator.username}-${item.anime.slug}-${i}`}>
              <Link
                href={
                  item.review
                    ? `/anime/${item.anime.slug}#review-${item.review.id}`
                    : `/anime/${item.anime.slug}?creator=${encodeURIComponent(item.creator.username)}#creators`
                }
                className={styles.feedCard}
              >
                <span className={styles.poster}>{item.anime.posterUrl && <AnimeImage src={item.anime.posterUrl} alt="" fill sizes="56px" />}</span>
                <span className={styles.feedText}>
                  <span className={styles.feedWho}>
                    <strong>{item.creator.name}</strong> {verb(item)}
                  </span>
                  <span className={styles.feedAnime}>{item.anime.title}</span>
                  <span className={styles.feedWhat}>
                    {/* The anime's community retention, not the creator's 1–10 (2026-10-25, owner). */}
                    {item.kind === 'RATED' && <PeakedAt animeId={item.anime.id} />}
                    {item.kind === 'REVIEWED' && (
                      <span>
                        <MessageSquare size={12} aria-hidden="true" /> {item.review?.title}
                      </span>
                    )}
                    {item.kind === 'HYPED' && (
                      <span className={styles.hype}>
                        <HypeIcon size={12} aria-hidden="true" /> Hyped
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
