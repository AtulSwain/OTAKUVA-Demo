'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Star, Edit3, MessageSquare, FileText, PenLine, Check, X, CalendarDays, Share2, Clapperboard, ExternalLink } from 'lucide-react';
import { useLibrary } from '../../../context/LibraryContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { Anime } from '../../../types/anime';
import { AnimeCard } from '../../../components/ui/AnimeCard';
import { AnimeGrid } from '../../../components/ui/AnimeGrid';
import { ProfileActivity } from '../../../components/profile/ProfileActivity';
import { ProfileEditModal } from '../../../components/profile/ProfileEditModal';
import { ProfileBadgePanel } from '../../../components/profile/ProfileBadgePanel';
import { ShareProfileSheet } from '../../../components/profile/ShareProfileSheet';
import { ArticleCard, type ArticleCardData } from '../../../components/articles/ArticleCard';
import { ScrollReveal } from '../../../components/ui/ScrollReveal';
import { FollowButton } from '../../../components/social/FollowButton';
import { FollowListSheet, type FollowListKind } from '../../../components/social/FollowListSheet';
import { ProfileCollections, ProfileCommunities, ProfileRatings } from '../../../components/profile/ProfilePublicSections';
import { CreatorDashboard } from '../../../components/creator/CreatorDashboard';
import { isCreator } from '../../../lib/roles';
import BadgeChip from '../../../components/badges/BadgeChip';
import Seal from '../../../components/badges/Seal';
import { tierVars } from '../../../components/badges/tierStyle';
import { getTier, type TierKey } from '../../../lib/badges/tiers';
import { BADGE_STRINGS } from '../../../lib/badges/strings';
import { avatarInitial, getAvatarUrl, resolveAvatarUrl, resolveMediaUrl } from '../../../lib/mediaResolver';
import styles from './profile.module.css';

type ProfileTab = 'dashboard' | 'overview' | 'reviews' | 'rated' | 'collections' | 'articles' | 'communities' | 'library' | 'favorites' | 'activity';
const TAB_KEYS: ProfileTab[] = ['dashboard', 'overview', 'reviews', 'rated', 'collections', 'articles', 'communities', 'library', 'favorites', 'activity'];
/** Only the owner sees these (their own library, favourites and full activity). */
const OWNER_ONLY_TABS: ProfileTab[] = ['dashboard', 'library', 'favorites', 'activity'];

const BIO_MAX_LENGTH = 500;

interface ProfileInfo {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  createdAt: string | null;
}

interface FollowState {
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  followsYou: boolean;
  isCreator?: boolean;
  channelName?: string | null;
  channelUrl?: string | null;
}

const fmt = (n: number) => n.toLocaleString('en-US');

export default function ProfilePage({ params }: { params: { username: string } }) {
  const { library, counts } = useLibrary();
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const decoded = decodeURIComponent(params.username);
  const isSelf = params.username === 'you' || Boolean(user && user.username === decoded);
  // "/profile/you" before sign-in has no one to show — never a made-up name.
  const rawUsername = params.username === 'you' ? user?.username || '' : decoded;

  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [badge, setBadge] = useState<{ tier: TierKey; countedReviewCount: number } | null>(null);
  const [articles, setArticles] = useState<ArticleCardData[]>([]);
  const [articleTotal, setArticleTotal] = useState(0);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [follow, setFollow] = useState<FollowState | null>(null);
  const [followList, setFollowList] = useState<FollowListKind | null>(null);

  // ?tab=activity / ?tab=dashboard (links from notifications, the share card,
  // and the header's creator button — which can fire while already here).
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab') as ProfileTab | null;
  useEffect(() => {
    if (tabParam && TAB_KEYS.includes(tabParam)) setActiveTab(tabParam);
  }, [tabParam]);

  // Profile record (bio, images, join date) — always from the server, so a
  // stale cached session can't show old details.
  useEffect(() => {
    if (!rawUsername) return;
    let cancelled = false;
    setNotFound(false);
    fetch(`/api/profile?username=${encodeURIComponent(rawUsername)}`, { cache: 'no-store' })
      .then((res) => {
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (cancelled || !data?.user) return;
        setProfile({
          username: data.user.username,
          displayName: data.user.displayName || data.user.username,
          bio: data.user.bio || '',
          avatarUrl: data.user.avatarUrl ?? null,
          bannerUrl: data.user.bannerUrl ?? null,
          createdAt: data.user.createdAt ?? null,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rawUsername]);

  // Followers / following, and whether the viewer follows them.
  const loadFollow = useCallback(() => {
    if (!rawUsername) return;
    fetch(`/api/users/${encodeURIComponent(rawUsername)}/follow`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setFollow(d))
      .catch(() => {});
  }, [rawUsername]);
  useEffect(() => {
    loadFollow();
  }, [loadFollow, user?.id]);

  // Level, real activity and articles, in parallel.
  useEffect(() => {
    if (!rawUsername) return;
    let cancelled = false;
    const u = encodeURIComponent(rawUsername);
    fetch(`/api/users/${u}/badges`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && d?.tier && setBadge({ tier: d.tier, countedReviewCount: d.countedReviewCount ?? 0 }))
      .catch(() => {});
    fetch(`/api/articles?author=${u}&limit=24`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setArticles(d.articles || []);
        setArticleTotal(d.total || 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rawUsername]);

  useEffect(() => {
    if (!rawUsername) return;
    let cancelled = false;
    setIsReviewsLoading(true);
    fetch(`/api/reviews?${isSelf && user?.id ? `userId=${user.id}` : `username=${encodeURIComponent(rawUsername)}`}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => !cancelled && data?.reviews && setReviews(data.reviews))
      .catch(() => {})
      .finally(() => !cancelled && setIsReviewsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [rawUsername, isSelf, user?.id]);

  // Stats come from the server so they are correct for any profile, and are
  // re-fetched whenever the viewer's own library changes.
  const [serverStats, setServerStats] = useState<{
    completed: number; watching: number; total: number; episodes: number; watchMinutes: number; meanScore: number | null;
  } | null>(null);
  const librarySignature = useMemo(
    () => Object.values(library).map((i) => `${i.animeId}:${i.status}:${i.episodesWatched}:${i.personalRating ?? ''}`).sort().join('|'),
    [library]
  );
  useEffect(() => {
    if (!rawUsername) return;
    let cancelled = false;
    fetch(`/api/users/${encodeURIComponent(rawUsername)}/stats`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && d && setServerStats(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawUsername, isSelf ? librarySignature : '', isSelf ? counts : null]);

  // The library context is the *viewer's* library, so it can only stand in
  // for this profile's library when the viewer is the owner.
  const favorites = useMemo(
    () => (isSelf ? (Object.values(library).filter((i) => i.isFavorite).map((i) => i.anime).filter(Boolean) as Anime[]) : []),
    [library, isSelf]
  );
  const libraryItems = useMemo(
    () => (isSelf ? (Object.values(library).map((i) => i.anime).filter(Boolean) as Anime[]) : []),
    [library, isSelf]
  );

  const saveBio = async () => {
    const next = bioDraft.trim();
    setSavingBio(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save your bio.');
      setProfile((p) => (p ? { ...p, bio: next } : p));
      setEditingBio(false);
      refreshUser().catch(() => {});
      showToast('Bio saved', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSavingBio(false);
    }
  };

  const openLevel = () => {
    setActiveTab('overview');
    requestAnimationFrame(() => document.getElementById('level')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  if (!rawUsername) {
    return (
      <div className={styles.profilePage}>
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Sign in to see your profile</p>
        </div>
      </div>
    );
  }
  if (notFound) {
    return (
      <div className={styles.profilePage}>
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No member called @{rawUsername}</p>
          <Link href="/" className={styles.primaryBtn}>Back home</Link>
        </div>
      </div>
    );
  }

  const tier = getTier(badge?.tier || 'shoshinsha');
  const tierGloss = BADGE_STRINGS.gloss[tier.key] || '';
  const joined = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : null;
  const bannerSrc = profile?.bannerUrl ? resolveMediaUrl(profile.bannerUrl) || profile.bannerUrl : null;
  const photo = resolveAvatarUrl(profile?.avatarUrl);
  const name = profile?.displayName || rawUsername;
  const handle = profile?.username || rawUsername;

  const stats: Array<[string | number, string]> = [
    [fmt(serverStats?.completed ?? 0), 'Completed'],
    [fmt(serverStats?.watching ?? 0), 'Watching'],
    [fmt(serverStats?.episodes ?? 0), 'Episodes'],
    [`${((serverStats?.watchMinutes ?? 0) / 60).toFixed(1)}h`, 'Watch time'],
    [serverStats?.meanScore != null ? serverStats.meanScore.toFixed(1) : '—', 'Mean score'],
  ];

  // Visitors see a member's public record; the owner also sees their own
  // library, favourites and full activity.
  // A creator's own profile is also their creator dashboard — one place for
  // both (owner, 2026-10-24). Only they see that tab.
  const ownCreatorProfile = isSelf && isCreator(user?.role);
  const tabs: Array<{ key: ProfileTab; label: string; count?: number }> = [
    ...(ownCreatorProfile ? ([{ key: 'dashboard', label: 'Creator dashboard' }] as const) : []),
    { key: 'overview', label: 'Overview' },
    { key: 'reviews', label: 'Reviews', count: reviews.length },
    { key: 'rated', label: 'Rated' },
    { key: 'collections', label: 'Collections' },
    { key: 'articles', label: 'Articles', count: articleTotal },
    { key: 'communities', label: 'Communities' },
    ...(isSelf
      ? ([
          { key: 'library', label: 'Library', count: libraryItems.length },
          { key: 'favorites', label: 'Favorites', count: favorites.length },
          { key: 'activity', label: 'Activity' },
        ] as const)
      : []),
  ];
  const tab: ProfileTab =
    (!isSelf && OWNER_ONLY_TABS.includes(activeTab)) || (activeTab === 'dashboard' && !ownCreatorProfile) ? 'overview' : activeTab;

  // One review list for the Reviews tab and the visitor overview. Visitors
  // never see the text of a spoiler review here (same rule as activity).
  const renderReviews = (list: any[]) => (
    <div className={styles.reviews}>
      {list.map((rev) => (
        <article key={rev.id} className={styles.review}>
          <Link href={`/anime/${rev.anime?.slug || rev.anime?.id}`} className={styles.reviewPoster} tabIndex={-1} aria-hidden="true">
            {rev.anime?.posterImage && (
              <Image src={rev.anime.posterImage} alt="" fill sizes="64px" className={styles.reviewPosterImg} unoptimized />
            )}
          </Link>
          <div className={styles.reviewMain}>
            <div className={styles.reviewTop}>
              <Link href={`/anime/${rev.anime?.slug || rev.anime?.id}`} className={styles.reviewAnime}>
                {rev.anime?.title || 'Anime'}
              </Link>
              {typeof rev.rating === 'number' && (
                <span className={styles.reviewScore}>
                  <Star size={12} fill="currentColor" stroke="none" aria-hidden="true" />
                  {rev.rating.toFixed(1)}
                </span>
              )}
              {rev.spoilerLevel && rev.spoilerLevel !== 'SPOILER_FREE' && (
                <span className={styles.reviewSpoiler}>{rev.spoilerLevel.replace('_', ' ').toLowerCase()}</span>
              )}
            </div>
            {rev.title && <h3 className={styles.reviewHeadline}>{rev.title}</h3>}
            {rev.spoilerLevel && rev.spoilerLevel !== 'SPOILER_FREE' && !isSelf ? (
              <p className={styles.reviewBody}>Contains spoilers — read it on the anime page.</p>
            ) : (
              <p className={styles.reviewBody}>{rev.body}</p>
            )}
            <div className={styles.reviewMeta}>
              <span>
                {new Date(rev.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                {rev.edited && ' · edited'}
              </span>
              <span>
                {fmt(rev.likesCount || 0)} helpful
              </span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );

  return (
    <div className={styles.profilePage}>
      {/* 1. Banner fading into the page; identity overlapping it */}
      <header className={styles.hero}>
        <div className={`${styles.banner} ${bannerSrc ? '' : styles.bannerPlain}`} aria-hidden="true">
          {bannerSrc && <Image src={bannerSrc} alt="" fill priority className={styles.bannerImg} unoptimized sizes="100vw" />}
          <div className={styles.bannerShade} />
        </div>

        <div className={styles.identity}>
          <div className={styles.avatarWrap} style={tierVars(tier)} data-tier={tier.key}>
            <div className={styles.avatar}>
              {photo ? (
                <Image src={photo} alt={name} fill className={styles.avatarImg} unoptimized />
              ) : (
                <span className={styles.avatarMonogram} aria-label={name}>
                  {avatarInitial(name)}
                </span>
              )}
            </div>
            <button type="button" className={styles.avatarSeal} onClick={openLevel} title={`${tier.name} · ${tierGloss}`} aria-label={`Level: ${tier.name}`}>
              <Seal tier={tier} size={36} decorative />
            </button>
          </div>

          <div className={styles.identityMain}>
            <div className={styles.nameRow}>
              <h1 className={styles.displayName}>{name}</h1>
              {follow?.isCreator && (
                <span className={styles.creatorChip} title="Creator account">
                  <Clapperboard size={13} aria-hidden="true" /> Creator
                </span>
              )}
              <BadgeChip tier={tier} count={badge?.countedReviewCount} />
            </div>
            <div className={styles.handleRow}>
              <span className={styles.handle}>@{handle}</span>
              {follow?.isCreator && follow.channelName && (
                follow.channelUrl ? (
                  <a href={follow.channelUrl} target="_blank" rel="noopener noreferrer nofollow" className={styles.channel}>
                    {follow.channelName} <ExternalLink size={12} aria-hidden="true" />
                  </a>
                ) : (
                  <span className={styles.channel}>{follow.channelName}</span>
                )
              )}
              {follow?.followsYou && <span className={styles.followsYou}>Follows you</span>}
            </div>

            {/* Social counts, Instagram-style */}
            <div className={styles.counts}>
              {/* Creators: the audience number leads, YouTube/Instagram-style. */}
              <button
                type="button"
                className={`${styles.countBtn} ${follow?.isCreator ? styles.countBig : ''}`}
                onClick={() => setFollowList('followers')}
              >
                <strong>{fmt(follow?.followerCount ?? 0)}</strong> {follow?.followerCount === 1 ? 'follower' : 'followers'}
              </button>
              <button type="button" className={styles.countBtn} onClick={() => setFollowList('following')}>
                <strong>{fmt(follow?.followingCount ?? 0)}</strong> following
              </button>
              <button type="button" className={styles.countBtn} onClick={() => setActiveTab('reviews')}>
                <strong>{fmt(reviews.length)}</strong> {reviews.length === 1 ? 'review' : 'reviews'}
              </button>
              <button type="button" className={styles.countBtn} onClick={() => setActiveTab('articles')}>
                <strong>{fmt(articleTotal)}</strong> {articleTotal === 1 ? 'article' : 'articles'}
              </button>
            </div>
          </div>

          <div className={styles.actions}>
            {!isSelf && profile && (
              <FollowButton
                username={profile.username}
                following={Boolean(follow?.isFollowing)}
                followsYou={Boolean(follow?.followsYou)}
                onChange={(following, followerCount) =>
                  setFollow((f) =>
                    f
                      ? {
                          ...f,
                          isFollowing: following,
                          followerCount: followerCount ?? Math.max(0, f.followerCount + (following === f.isFollowing ? 0 : following ? 1 : -1)),
                        }
                      : f
                  )
                }
              />
            )}
            {isSelf && (
              <>
                <button type="button" className={styles.primaryBtn} onClick={() => setIsEditModalOpen(true)}>
                  <Edit3 size={14} aria-hidden="true" /> Edit profile
                </button>
                <Link href="/articles/new" className={`${styles.quietBtn} ${styles.writeBtn}`}>
                  <PenLine size={14} aria-hidden="true" /> Write
                </Link>
              </>
            )}
            {/* Sharing your profile card is the owner's action, not a visitor's. */}
            {isSelf && profile && (
              <button type="button" className={`${styles.quietBtn} ${styles.iconOnly}`} onClick={() => setShareOpen(true)} aria-label="Share profile" title="Share profile">
                <Share2 size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Bio + facts — part of the header, no separate box */}
      <section className={styles.about} aria-label="About">
        {editingBio ? (
          <div className={styles.bioEditor}>
            <textarea
              className={styles.bioInput}
              value={bioDraft}
              maxLength={BIO_MAX_LENGTH}
              onChange={(e) => setBioDraft(e.target.value)}
              placeholder="Tell other fans about yourself: what you watch, favourite genres, the shows that got you into anime…"
              rows={4}
              autoFocus
            />
            <div className={styles.bioEditorBar}>
              <span className={styles.bioCount}>
                {bioDraft.length}/{BIO_MAX_LENGTH}
              </span>
              <button type="button" className={styles.textBtn} onClick={() => setEditingBio(false)} disabled={savingBio}>
                <X size={13} aria-hidden="true" /> Cancel
              </button>
              <button type="button" className={styles.saveBtn} onClick={saveBio} disabled={savingBio}>
                <Check size={13} aria-hidden="true" /> {savingBio ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : profile?.bio ? (
          <p className={styles.bioText}>
            {profile.bio}
            {isSelf && (
              <button
                type="button"
                className={styles.inlineEdit}
                onClick={() => {
                  setBioDraft(profile.bio);
                  setEditingBio(true);
                }}
                aria-label="Edit bio"
              >
                <Edit3 size={12} aria-hidden="true" />
              </button>
            )}
          </p>
        ) : isSelf ? (
          <button
            type="button"
            className={styles.bioPrompt}
            onClick={() => {
              setBioDraft('');
              setEditingBio(true);
            }}
          >
            <Edit3 size={13} aria-hidden="true" /> Add a bio, so other fans know what you watch
          </button>
        ) : null}

        <div className={styles.facts}>
          <button type="button" className={styles.levelLink} onClick={openLevel}>
            Level <strong>{tier.name}</strong>
            {tierGloss && <span> · {tierGloss}</span>}
          </button>
          {joined && (
            <span className={styles.joined}>
              <CalendarDays size={13} aria-hidden="true" /> Joined {joined}
            </span>
          )}
        </div>
      </section>

      {isSelf && profile && (
        <ShareProfileSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          card={{
            displayName: profile.displayName || profile.username,
            username: profile.username,
            avatarUrl: getAvatarUrl({ avatarUrl: profile.avatarUrl, username: profile.username, displayName: profile.displayName }),
            bannerUrl: bannerSrc,
            tier: tier.key,
            countedReviews: badge?.countedReviewCount ?? 0,
            // Only real, loaded numbers go on the card — nothing while stats are still loading.
            stats: serverStats
              ? [
                  { label: 'Completed', value: serverStats.completed.toLocaleString('en-US') },
                  { label: 'Episodes', value: serverStats.episodes.toLocaleString('en-US') },
                  ...(serverStats.meanScore != null ? [{ label: 'Mean score', value: serverStats.meanScore.toFixed(1) }] : []),
                ]
              : [],
            profileUrl: typeof window !== 'undefined' ? `${window.location.origin}/profile/${encodeURIComponent(profile.username)}` : `/profile/${encodeURIComponent(profile.username)}`,
          }}
        />
      )}

      <FollowListSheet
        username={handle}
        kind={followList}
        counts={{ followers: follow?.followerCount ?? 0, following: follow?.followingCount ?? 0 }}
        onKindChange={setFollowList}
        onClose={() => {
          setFollowList(null);
          loadFollow();
        }}
      />

      {/* 3. Watch stats — the owner's own numbers, a quiet strip */}
      {isSelf && (
        <dl className={styles.stats}>
          {stats.map(([val, label]) => (
            <div key={label} className={styles.stat}>
              <dt>{label}</dt>
              <dd>{val}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* 4. Tabs */}
      <div className={styles.tabsNav} role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`${styles.tabBtn} ${tab === t.key ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {typeof t.count === 'number' && <span className={styles.tabCount}>{fmt(t.count)}</span>}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {/* Someone else's profile: their public record and the stamps they've collected. */}
        {tab === 'dashboard' && ownCreatorProfile && <CreatorDashboard embedded />}

        {tab === 'overview' && !isSelf && (
          <>
            <ScrollReveal>
              <div id="level" className={styles.levelAnchor}>
                <ProfileBadgePanel username={rawUsername} variant="public" />
              </div>
            </ScrollReveal>
            {reviews.length > 0 && (
              <ScrollReveal delayMs={40}>
                <section>
                  <div className={styles.sectionHeadRow}>
                    <h2 className={styles.sectionTitle}>Latest reviews</h2>
                    {reviews.length > 3 && (
                      <button type="button" className={styles.textBtn} onClick={() => setActiveTab('reviews')}>
                        See all {fmt(reviews.length)}
                      </button>
                    )}
                  </div>
                  {renderReviews(reviews.slice(0, 3))}
                </section>
              </ScrollReveal>
            )}
            <ScrollReveal delayMs={60}>
              <ProfileRatings username={rawUsername} name={name} limit={12} onSeeAll={() => setActiveTab('rated')} />
            </ScrollReveal>
            {articles.length > 0 && (
              <ScrollReveal delayMs={80}>
                <section>
                  <div className={styles.sectionHeadRow}>
                    <h2 className={styles.sectionTitle}>Latest articles</h2>
                    <button type="button" className={styles.textBtn} onClick={() => setActiveTab('articles')}>
                      See all
                    </button>
                  </div>
                  <div className={styles.articlesGrid}>
                    {articles.slice(0, 3).map((a) => (
                      <ArticleCard key={a.id} article={a} hideAuthor />
                    ))}
                  </div>
                </section>
              </ScrollReveal>
            )}
          </>
        )}

        {tab === 'overview' && isSelf && (
          <>
            {/* Everything they've done lately (all features), compact */}
            <ScrollReveal>
              <ProfileActivity username={rawUsername} compact onSeeAll={() => setActiveTab('activity')} />
            </ScrollReveal>
            {articles.length > 0 && (
              <ScrollReveal delayMs={50}>
                <section>
                  <div className={styles.sectionHeadRow}>
                    <h2 className={styles.sectionTitle}>Latest articles</h2>
                    <button type="button" className={styles.textBtn} onClick={() => setActiveTab('articles')}>
                      See all
                    </button>
                  </div>
                  <div className={styles.articlesGrid}>
                    {articles.slice(0, 3).map((a) => (
                      <ArticleCard key={a.id} article={a} hideAuthor />
                    ))}
                  </div>
                </section>
              </ScrollReveal>
            )}
            {favorites.length > 0 && (
              <ScrollReveal delayMs={80}>
                <section>
                  <div className={styles.sectionHeadRow}>
                    <h2 className={styles.sectionTitle}>Favorite anime</h2>
                  </div>
                  <AnimeGrid columns={6}>
                    {favorites.map((anime) => (
                      <AnimeCard key={anime.id} anime={anime} />
                    ))}
                  </AnimeGrid>
                </section>
              </ScrollReveal>
            )}
            {/* Your level: seal, progress, the journey with your stamps */}
            <div id="level" className={styles.levelAnchor}>
              <ProfileBadgePanel username={rawUsername} showCommunities={false} />
            </div>
          </>
        )}

        {tab === 'rated' && (
          <ScrollReveal>
            <ProfileRatings username={rawUsername} name={name} />
          </ScrollReveal>
        )}

        {tab === 'collections' && (
          <ScrollReveal>
            <ProfileCollections username={rawUsername} name={name} isSelf={isSelf} />
          </ScrollReveal>
        )}

        {tab === 'communities' && (
          <ScrollReveal>
            <ProfileCommunities username={rawUsername} name={name} />
          </ScrollReveal>
        )}

        {tab === 'articles' && (
          <ScrollReveal>
            {articles.length > 0 ? (
              <div className={styles.articlesGrid}>
                {articles.map((a) => (
                  <ArticleCard key={a.id} article={a} hideAuthor />
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <FileText size={32} className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No articles yet</p>
                <p className={styles.emptySub}>
                  {isSelf
                    ? 'Found some anime news or information worth sharing? Write it up for everyone.'
                    : `${name} hasn't shared any articles yet.`}
                </p>
                {isSelf && (
                  <Link href="/articles/new" className={styles.primaryBtn}>
                    Write an article
                  </Link>
                )}
              </div>
            )}
          </ScrollReveal>
        )}

        {tab === 'library' && isSelf && (
          <ScrollReveal>
            <AnimeGrid columns={6}>
              {libraryItems.map((anime) => (
                <AnimeCard key={anime.id} anime={anime} />
              ))}
            </AnimeGrid>
          </ScrollReveal>
        )}

        {tab === 'favorites' && isSelf && (
          <ScrollReveal>
            <AnimeGrid columns={6}>
              {favorites.map((anime) => (
                <AnimeCard key={anime.id} anime={anime} />
              ))}
            </AnimeGrid>
          </ScrollReveal>
        )}

        {tab === 'activity' && (
          <ScrollReveal>
            <ProfileActivity username={rawUsername} />
          </ScrollReveal>
        )}

        {tab === 'reviews' && (
          <ScrollReveal>
            {isReviewsLoading ? (
              <div className={styles.loading}>Loading reviews…</div>
            ) : reviews.length === 0 ? (
              <div className={styles.empty}>
                <MessageSquare size={32} className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No reviews published yet</p>
                <p className={styles.emptySub}>
                  {isSelf
                    ? 'Explore anime, rate them, and share your thoughts to build your reviews archive.'
                    : `${name} has not written any community reviews yet.`}
                </p>
                {isSelf && (
                  <Link href="/top-picks" className={styles.primaryBtn}>
                    Explore anime
                  </Link>
                )}
              </div>
            ) : (
              renderReviews(reviews)
            )}
          </ScrollReveal>
        )}
      </div>

      {profile && (
        <ProfileEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          initialProfile={{
            displayName: profile.displayName,
            username: profile.username,
            bio: profile.bio,
            avatarUrl: profile.avatarUrl,
            bannerUrl: profile.bannerUrl,
          }}
          onSave={(updated: any) => {
            setProfile((p) => (p ? { ...p, ...updated } : p));
            refreshUser().catch(() => {});
          }}
        />
      )}
    </div>
  );
}
