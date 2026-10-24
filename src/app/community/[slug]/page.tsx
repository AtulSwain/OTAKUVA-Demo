'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MessageSquare, Check, ArrowLeft, Pin, Menu } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { SocketProvider } from '../../../context/SocketContext';
import { CommunityBadgeMembers } from '../../../components/community/CommunityBadgeMembers';
import { MediaPicker } from '../../../components/community/MediaPicker';
import { CommunityTopicPicker, type TopicAnime } from '../../../components/community/CommunityTopicPicker';
import { CommunityChatView, type ChannelItem } from '../../../components/community/CommunityChatView';
import { CommunityServerRail } from '../../../components/community/CommunityServerRail';
import {
  CommunityChannelSidebar,
  type WorkspaceView,
} from '../../../components/community/CommunityChannelSidebar';
import { CommunityMemberList } from '../../../components/community/CommunityMemberList';
import { CommunityEntrySplash } from '../../../components/community/CommunityEntrySplash';
import styles from './communitySlug.module.css';
import { resolveAvatarUrl } from '../../../lib/mediaResolver';

interface CommunityDetail {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string;
  iconUrl?: string | null;
  iconSource?: string | null;
  bannerUrl?: string | null;
  bannerSource?: string | null;
  category: string;
  visibility: string;
  memberCount: number;
  discussionCount: number;
  membershipStatus?: string | null;
  userRole?: string | null;
  createdAt: string;
  owner: { id: string; username: string; avatarUrl?: string };
  channels: { id: string; name: string; slug: string; type: string }[];
  rules: { id: string; position: number; title: string; content: string }[];
  members: { id: string; role: string; user: { id: string; username: string; avatarUrl?: string } }[];
  anime?: { id: string; canonicalTitle: string; slug: string; posterUrl: string; bannerUrl?: string };
}

interface DiscussionItem {
  id: string;
  title: string;
  body: string;
  type: string;
  spoilerLevel: string;
  replyCount: number;
  helpfulCount: number;
  createdAt: string;
  author: { username: string; avatarUrl?: string };
  channel?: { name: string; slug: string };
}

export default function CommunitySlugPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();

  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [view, setView] = useState<WorkspaceView>('chat');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [discussions, setDiscussions] = useState<DiscussionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Workspace chrome
  const [showSplash, setShowSplash] = useState(true);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isMemberListOpen, setIsMemberListOpen] = useState(false);

  const [isJoinPending, setIsJoinPending] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [reviewingUserId, setReviewingUserId] = useState<string | null>(null);

  // Manage / Edit Form State
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editVisibility, setEditVisibility] = useState('');
  const [editIconUrl, setEditIconUrl] = useState<string | null>(null);
  const [editIconSource, setEditIconSource] = useState<'UPLOAD' | 'URL'>('URL');
  const [editBannerUrl, setEditBannerUrl] = useState<string | null>(null);
  const [editBannerSource, setEditBannerSource] = useState<'UPLOAD' | 'URL'>('URL');
  const [editAnime, setEditAnime] = useState<TopicAnime | null>(null);
  const [editGenreIds, setEditGenreIds] = useState<string[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchCommunity = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/communities/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setCommunity(data.community);

        // Pre-fill edit form
        setEditName(data.community.name);
        setEditDescription(data.community.description);
        setEditCategory(data.community.category);
        setEditVisibility(data.community.visibility);
        setEditIconUrl(data.community.iconUrl);
        setEditIconSource(data.community.iconSource || 'URL');
        setEditBannerUrl(data.community.bannerUrl);
        setEditBannerSource(data.community.bannerSource || 'URL');
        const a = data.community.anime;
        setEditAnime(a ? { id: a.id, slug: a.slug, title: a.canonicalTitle, posterUrl: a.posterUrl ?? null } : null);
        setEditGenreIds(Array.isArray(data.community.genres) ? data.community.genres.map((g: any) => g.genre?.id ?? g.id).filter(Boolean) : []);

        // Keep the current channel if it still exists, else land on #general.
        const chs: ChannelItem[] = data.community.channels || [];
        setSelectedChannelId((prev) =>
          prev && chs.some((c) => c.id === prev)
            ? prev
            : (chs.find((c) => c.slug === 'general') || chs[0])?.id ?? null
        );
      }
    } catch (err) {
      console.error('Error loading community:', err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const fetchDiscussions = React.useCallback(async () => {
    if (!community) return;
    try {
      const res = await fetch(`/api/discussions?communityId=${community.id}`);
      if (res.ok) {
        const data = await res.json();
        setDiscussions(data.discussions || []);
      }
    } catch (err) {
      console.error('Error fetching discussions:', err);
    }
  }, [community]);

  useEffect(() => {
    if (slug) fetchCommunity();
  }, [slug, user, fetchCommunity]);

  // Entering another community (rail click) replays the entry splash.
  useEffect(() => {
    setShowSplash(true);
    setView('chat');
    setSelectedChannelId(null);
    setIsNavOpen(false);
  }, [slug]);

  // Member list starts open where there is room for it, like Discord.
  useEffect(() => {
    setIsMemberListOpen(window.matchMedia('(min-width: 1180px)').matches);
  }, []);

  useEffect(() => {
    if (community && view === 'home') fetchDiscussions();
  }, [community, view, fetchDiscussions]);

  // Join requests are admin-only; the endpoint returns 403 for everyone else,
  // so this is only called once the server has confirmed a managing role.
  const fetchJoinRequests = React.useCallback(async () => {
    if (!community) return;
    try {
      const res = await fetch(`/api/communities/${community.slug}/requests`);
      if (!res.ok) return;
      const data = await res.json();
      setJoinRequests(data.requests || []);
    } catch (err) {
      console.error('Error loading join requests:', err);
    }
  }, [community]);

  // Load pending requests when a manager opens the manage tab.
  useEffect(() => {
    if (
      community &&
      view === 'manage' &&
      (community.userRole === 'ADMIN' || community.userRole === 'OWNER' || community.ownerId === user?.id)
    ) {
      fetchJoinRequests();
    }
  }, [community, view, user?.id, fetchJoinRequests]);

  const handleReviewRequest = async (targetUserId: string, action: 'APPROVE' | 'REJECT') => {
    if (!community) return;
    setReviewingUserId(targetUserId);
    try {
      const res = await fetch(`/api/communities/${community.slug}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId, action }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Leave the row in place — the request was not actually decided.
        showToast(data?.error || 'Could not update that request.', 'error');
        return;
      }

      setJoinRequests((prev) => prev.filter((r) => r.userId !== targetUserId));
      showToast(action === 'APPROVE' ? 'Request approved.' : 'Request declined.', 'success');
      // Member count and membership state are server-owned; re-read rather
      // than deriving them locally.
      await fetchCommunity();
    } catch (err) {
      console.error('Error reviewing join request:', err);
      showToast('Could not update that request.', 'error');
    } finally {
      setReviewingUserId(null);
    }
  };

  const handleJoinToggle = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    if (!community) return;
    const status = community.membershipStatus;

    // Pending and banned are terminal for this control — there is nothing to
    // toggle, and re-posting would only bounce off the server guards.
    if (status === 'PENDING' || status === 'BANNED') return;

    const isMember = status === 'ACTIVE';
    const endpoint = `/api/communities/${community.slug}/${isMember ? 'leave' : 'join'}`;

    setIsJoinPending(true);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Never show a membership state the server did not confirm.
        showToast(data?.error || 'Could not update your membership. Try again.', 'error');
        return;
      }

      setCommunity((prev) =>
        prev
          ? {
              ...prev,
              membershipStatus: data.status,
              userRole: data.role || (data.status === 'ACTIVE' ? 'MEMBER' : null),
              memberCount: data.memberCount ?? prev.memberCount,
            }
          : null
      );

      if (data.status === 'PENDING') {
        showToast('Request sent. An admin will review it.', 'success');
      }
    } catch (err) {
      console.error('Error updating membership:', err);
      showToast('Could not update your membership. Try again.', 'error');
    } finally {
      setIsJoinPending(false);
    }
  };

  const selectChannel = (channel: ChannelItem) => {
    setSelectedChannelId(channel.id);
    setView('chat');
    setIsNavOpen(false);
  };

  const handleSaveCommunitySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!community) return;

    setIsSavingSettings(true);
    setSaveMessage(null);

    try {
      const res = await fetch(`/api/communities/${community.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          category: editCategory,
          visibility: editVisibility,
          iconUrl: editIconUrl,
          iconSource: editIconSource,
          bannerUrl: editBannerUrl,
          bannerSource: editBannerSource,
          animeId: editAnime ? editAnime.id : null,
          genreIds: editGenreIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update community');
      }

      setCommunity((prev) => (prev ? { ...prev, ...data.community } : null));
      setSaveMessage({ type: 'success', text: 'Community branding and settings updated successfully!' });
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message || 'Failed to update settings.' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.workspaceState}>
        <p className={styles.loadingState}>Loading community…</p>
      </div>
    );
  }

  if (!community) {
    return (
      <div className={styles.workspaceState}>
        <div className={styles.emptyCard}>
          <h2 className={styles.emptyTitle}>Community Not Found</h2>
          <Link href="/community" className={styles.backLink} style={{ marginTop: '12px' }}>
            <ArrowLeft size={14} aria-hidden="true" /> Back to all communities
          </Link>
        </div>
      </div>
    );
  }

  const isMember = community.membershipStatus === 'ACTIVE';
  const isOwner = Boolean(user && community.ownerId === user.id);
  const isMod =
    community.userRole === 'MODERATOR' || community.userRole === 'ADMIN' || community.userRole === 'OWNER' || isOwner;
  // Admins and owners review requests; MODERATOR maps to canManageMembers
  // being false server-side, so the list would 403 for them.
  const canManageRequests = Boolean(community.userRole === 'ADMIN' || community.userRole === 'OWNER' || isOwner);
  const needsApproval =
    community.visibility === 'REQUEST_TO_JOIN' || (community as any).joinPolicy === 'APPROVAL_REQUIRED';
  const selectedChannel = community.channels.find((c) => c.id === selectedChannelId) || null;
  // Refetch member-derived panels whenever membership changes.
  const membersKey = `${community.membershipStatus}-${community.memberCount}`;

  const VIEW_TITLE: Record<Exclude<WorkspaceView, 'chat'>, string> = {
    home: 'Overview',
    members: 'Members & badges',
    about: 'About & rules',
    manage: 'Manage',
  };

  return (
    <div className={styles.workspace}>
      {/* Left: server rail + channel sidebar (a drawer on narrow screens). */}
      <div className={`${styles.nav} ${isNavOpen ? styles.navOpen : ''}`}>
        <CommunityServerRail activeSlug={community.slug} userId={user?.id} refreshKey={community.membershipStatus} />
        <CommunityChannelSidebar
          community={{
            slug: community.slug,
            name: community.name,
            iconUrl: community.iconUrl,
            visibility: community.visibility,
            membershipStatus: community.membershipStatus,
            isOwner,
          }}
          channels={community.channels}
          selectedChannelId={selectedChannelId}
          view={view}
          canManage={Boolean(isMod || user?.role === 'ADMIN')}
          currentUser={user ? { id: user.id, username: user.username, avatarUrl: user.avatarUrl } : null}
          onSelectChannel={selectChannel}
          onSelectView={(v) => {
            setView(v);
            setIsNavOpen(false);
          }}
          onChannelCreated={(ch) => {
            setCommunity((prev) => (prev ? { ...prev, channels: [...prev.channels, ch] } : prev));
            selectChannel(ch);
            fetchCommunity();
          }}
          onLeave={handleJoinToggle}
          onSignIn={() => openAuthModal('login')}
        />
      </div>
      {isNavOpen && (
        <button type="button" className={styles.backdrop} aria-label="Close channels" onClick={() => setIsNavOpen(false)} />
      )}

      <main className={styles.main}>
        {view === 'chat' ? (
          // Socket connection is scoped to the chat view, not mounted app-wide:
          // only real-time chat needs it.
          <SocketProvider>
            <CommunityChatView
              community={community}
              channel={selectedChannel}
              currentUser={user ? { id: user.id, username: user.username } : null}
              onJoinToggle={handleJoinToggle}
              onOpenNav={() => setIsNavOpen(true)}
              isMemberListOpen={isMemberListOpen}
              onToggleMemberList={() => setIsMemberListOpen((v) => !v)}
            />
          </SocketProvider>
        ) : (
          <section className={styles.panel} aria-labelledby="workspace-view-title">
            <header className={styles.panelHeader}>
              <button type="button" className={styles.panelNavBtn} onClick={() => setIsNavOpen(true)} aria-label="Open channels">
                <Menu size={20} />
              </button>
              <h2 id="workspace-view-title" className={styles.panelTitle}>
                {VIEW_TITLE[view]}
              </h2>
            </header>
            <div className={styles.panelScroll}>
              <div className={styles.panelInner}>
      {/* TAB CONTENT: HOME */}
      {view === 'home' && (
        <div className={styles.homeLayout}>
          <div className={styles.mainCol}>
            <div className={styles.announcementCard}>
              <div className={styles.announcementHeader}>
                <Pin size={13} />
                <span>COMMUNITY ANNOUNCEMENT</span>
              </div>
              <p className={styles.announcementText}>
                Welcome to {community.name}! Please review our rules and participate in discussions in relevant channels. Tag all spoilers respectfully.
              </p>
            </div>

            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Recent Discussions</h3>
                <button type="button" className={styles.textBtn} onClick={() => setView('chat')}>
                  Open chat
                </button>
              </div>

              {discussions.length > 0 ? (
                <div className={styles.discList}>
                  {discussions.slice(0, 4).map((d) => (
                    <Link key={d.id} href={`/discussions/${d.id}`} className={styles.discItem}>
                      <div>
                        <span className={styles.discChannel}>/{d.channel?.name || 'general'}</span>
                        <h4 className={styles.discTitle}>{d.title}</h4>
                      </div>
                      <span className={styles.discReplies}>
                        <MessageSquare size={12} />
                        {d.replyCount}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No discussions yet.</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className={styles.sideCol}>
            <div className={styles.sideCard}>
              <h4 className={styles.sideTitle}>Community Rules</h4>
              <div className={styles.rulesList}>
                {community.rules.map((r, i) => (
                  <div key={r.id || i} className={styles.ruleItem}>
                    <span className={styles.ruleNum}>{i + 1}. {r.title}</span>
                    <p className={styles.ruleBody}>{r.content}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.sideCard}>
              <h4 className={styles.sideTitle}>Channels</h4>
              <div className={styles.channelsList}>
                {community.channels.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className={styles.channelLink}
                    onClick={() => selectChannel(ch)}
                  >
                    <span className={styles.channelSlash} aria-hidden="true">/</span>
                    <span>{ch.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}



      {/* TAB CONTENT: MEMBERS */}
      {view === 'members' && <CommunityBadgeMembers key={membersKey} slug={community.slug} />}

      {/* TAB CONTENT: ABOUT */}
      {view === 'about' && (
        <div className={styles.aboutCard}>
          <h3 className={styles.aboutTitle}>About {community.name}</h3>
          <p className={styles.aboutText}>{community.description}</p>
          <div className={styles.aboutMeta}>
            <div>
              <span className={styles.metaLabel}>Created</span>
              <span className={styles.metaVal}>{new Date(community.createdAt).toLocaleDateString()}</span>
            </div>
            <div>
              <span className={styles.metaLabel}>Owner</span>
              <span className={styles.metaVal}>@{community.owner?.username}</span>
            </div>
            <div>
              <span className={styles.metaLabel}>Category</span>
              <span className={styles.metaVal}>{community.category}</span>
            </div>
            <div>
              <span className={styles.metaLabel}>Visibility</span>
              <span className={styles.metaVal}>{community.visibility}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: MANAGE */}
      {/* Join request review — owners and admins only. The list itself is
          server-authorized; this block only decides whether to ask for it. */}
      {view === 'manage' && canManageRequests && (
        <div className={styles.manageCard} style={{ marginBottom: '16px' }}>
          <h3 className={styles.manageTitle}>Join Requests</h3>
          <p className={styles.manageSubtitle}>
            {joinRequests.length === 0
              ? 'No one is waiting for approval right now.'
              : `${joinRequests.length} ${joinRequests.length === 1 ? 'person is' : 'people are'} waiting for approval.`}
          </p>

          {joinRequests.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              {joinRequests.map((req) => (
                <div key={req.id} className={styles.memberCard}>
                  <div className={styles.memberAvatar}>
                    {resolveAvatarUrl(req.avatarUrl) ? (
                      <Image src={resolveAvatarUrl(req.avatarUrl) as string} alt={req.username} fill unoptimized style={{ objectFit: 'cover' }} />
                    ) : (
                      req.username?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className={styles.memberInfo} style={{ flex: 1 }}>
                    <span className={styles.memberName}>@{req.username}</span>
                    <span className={styles.memberRole}>
                      Requested {new Date(req.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className={`${styles.joinBtn} ${styles.joinedBtn}`}
                      onClick={() => handleReviewRequest(req.userId, 'APPROVE')}
                      disabled={reviewingUserId === req.userId}
                      aria-label={`Approve join request from ${req.username}`}
                    >
                      <Check size={13} />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      className={styles.joinBtn}
                      onClick={() => handleReviewRequest(req.userId, 'REJECT')}
                      disabled={reviewingUserId === req.userId}
                      aria-label={`Reject join request from ${req.username}`}
                    >
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'manage' && isMod && (
        <div className={styles.manageCard}>
          <h3 className={styles.manageTitle}>Community Settings &amp; Media Management</h3>
          <p className={styles.manageSubtitle}>
            Update community information, upload brand assets, or switch between local image uploads and external URLs.
          </p>

          {saveMessage && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                marginBottom: '14px',
                background: 'var(--surface-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-elevated)',
              }}
            >
              {saveMessage.text}
            </div>
          )}

          <form onSubmit={handleSaveCommunitySettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className={styles.metaLabel} style={{ marginBottom: '4px', display: 'block' }}>Community Name</label>
              <input
                type="text"
                className={styles.input}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className={styles.metaLabel} style={{ marginBottom: '4px', display: 'block' }}>Description</label>
              <textarea
                className={styles.textarea}
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label className={styles.metaLabel} style={{ marginBottom: '4px', display: 'block' }}>Category</label>
                <select
                  className={styles.select}
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                >
                  <option value="ANIME">Specific Anime</option>
                  <option value="GENRE">Genre / Theme</option>
                  <option value="MANGA">Manga &amp; Light Novels</option>
                  <option value="REGIONAL">Regional &amp; Language</option>
                  <option value="INTEREST">General Interest / Sakuga</option>
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label className={styles.metaLabel} style={{ marginBottom: '4px', display: 'block' }}>Visibility</label>
                <select
                  className={styles.select}
                  value={editVisibility}
                  onChange={(e) => setEditVisibility(e.target.value)}
                >
                  <option value="PUBLIC">Public</option>
                  <option value="REQUEST_TO_JOIN">Request to Join</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </div>
            </div>

            <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
              <CommunityTopicPicker
                anime={editAnime}
                onAnimeChange={setEditAnime}
                genreIds={editGenreIds}
                onGenresChange={setEditGenreIds}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
              <MediaPicker
                label="Community Icon"
                type="icon"
                currentUrl={editIconUrl}
                currentSource={editIconSource}
                communityId={community.id}
                onImageChange={(url, source) => {
                  setEditIconUrl(url);
                  setEditIconSource(source);
                }}
              />

              <MediaPicker
                label="Community Banner"
                type="banner"
                currentUrl={editBannerUrl}
                currentSource={editBannerSource}
                communityId={community.id}
                onImageChange={(url, source) => {
                  setEditBannerUrl(url);
                  setEditBannerSource(source);
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="submit"
                className={styles.postBtn}
                disabled={isSavingSettings}
              >
                {isSavingSettings ? 'Saving Changes...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      )}
              </div>
            </div>
          </section>
        )}
      </main>

      {view === 'chat' && isMemberListOpen && (
        <>
          <div className={styles.memberDock}>
            <CommunityMemberList
              slug={community.slug}
              refreshKey={membersKey}
              onShowAll={() => setView('members')}
            />
          </div>
          <button
            type="button"
            className={styles.memberBackdrop}
            aria-label="Close member list"
            onClick={() => setIsMemberListOpen(false)}
          />
        </>
      )}

      {showSplash && (
        <CommunityEntrySplash
          community={community}
          needsApproval={needsApproval}
          onJoin={handleJoinToggle}
          onDone={() => setShowSplash(false)}
        />
      )}
    </div>
  );
}
