'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Users,
  MessageSquare,
  Plus,
  Check,
  Shield,
  Clock,
  Hash,
  Share2,
  Lock,
  ArrowLeft,
  Pin,
  ChevronRight,
  Flame,
  Star,
  Send,
  Loader2,
  Settings,
  Edit,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { SocketProvider } from '../../../context/SocketContext';
import { SpoilerBlock } from '../../../components/community/SpoilerBlock';
import { CommunityImage } from '../../../components/ui/CommunityImage';
import { MediaPicker } from '../../../components/community/MediaPicker';
import { CommunityChatView } from '../../../components/community/CommunityChatView';
import styles from './communitySlug.module.css';

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

  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'discussions' | 'members' | 'about' | 'manage'>('discussions');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [discussions, setDiscussions] = useState<DiscussionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New Discussion Composer
  const [showComposer, setShowComposer] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newType, setNewType] = useState('GENERAL');
  const [newSpoiler, setNewSpoiler] = useState('NO_SPOILER');
  const [newChannelId, setNewChannelId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manage / Edit Form State
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editVisibility, setEditVisibility] = useState('');
  const [editIconUrl, setEditIconUrl] = useState<string | null>(null);
  const [editIconSource, setEditIconSource] = useState<'UPLOAD' | 'URL'>('URL');
  const [editBannerUrl, setEditBannerUrl] = useState<string | null>(null);
  const [editBannerSource, setEditBannerSource] = useState<'UPLOAD' | 'URL'>('URL');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchCommunity = async () => {
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

        if (data.community.channels?.length > 0) {
          setNewChannelId(data.community.channels[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading community:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscussions = async () => {
    if (!community) return;
    try {
      const channelParam = selectedChannel !== 'all' ? `&channelId=${selectedChannel}` : '';
      const res = await fetch(`/api/discussions?communityId=${community.id}${channelParam}`);
      if (res.ok) {
        const data = await res.json();
        setDiscussions(data.discussions || []);
      }
    } catch (err) {
      console.error('Error fetching discussions:', err);
    }
  };

  useEffect(() => {
    if (slug) fetchCommunity();
  }, [slug, user]);

  useEffect(() => {
    if (community) fetchDiscussions();
  }, [community, selectedChannel]);

  const handleJoinToggle = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    if (!community) return;
    const isMember = community.membershipStatus === 'ACTIVE';
    const endpoint = `/api/communities/${community.slug}/${isMember ? 'leave' : 'join'}`;

    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
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
      }
    } catch (err) {
      console.error('Error updating membership:', err);
    }
  };

  const handleCreateDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('login');
      return;
    }

    if (!community) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityId: community.id,
          channelId: newChannelId || undefined,
          title: newTitle.trim(),
          body: newBody.trim(),
          type: newType,
          spoilerLevel: newSpoiler,
        }),
      });

      if (res.ok) {
        setNewTitle('');
        setNewBody('');
        setShowComposer(false);
        fetchDiscussions();
      }
    } catch (err) {
      console.error('Error creating discussion:', err);
    } finally {
      setIsSubmitting(false);
    }
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
    return <div className={styles.loadingState}>Loading community...</div>;
  }

  if (!community) {
    return (
      <div className={styles.emptyCard}>
        <h2 className={styles.emptyTitle}>Community Not Found</h2>
        <Link href="/community" className={styles.backLink} style={{ marginTop: '12px' }}>
          ← Back to all communities
        </Link>
      </div>
    );
  }

  const isMember = community.membershipStatus === 'ACTIVE';
  const isOwner = user && community.ownerId === user.id;
  const isMod = community.userRole === 'MODERATOR' || community.userRole === 'OWNER' || isOwner;

  return (
    <div className={styles.container}>
      {/* Back Link */}
      <Link href="/community" className={styles.backLink}>
        <ArrowLeft size={14} />
        <span>All Communities</span>
      </Link>

      {/* Header Banner */}
      <div className={styles.bannerContainer}>
        <CommunityImage
          src={community.bannerUrl}
          type="banner"
          communityName={community.name}
          priority
        />
        <div className={styles.bannerOverlay} />
      </div>

      {/* Community Info Header */}
      <div className={styles.headerCard}>
        <div className={styles.headerMain}>
          <div className={styles.iconWrap}>
            <CommunityImage
              src={community.iconUrl}
              type="icon"
              communityName={community.name}
            />
          </div>

          <div className={styles.infoCol}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 className={styles.name}>{community.name}</h1>
              <span className={styles.categoryBadge}>{community.category}</span>
              {community.visibility !== 'PUBLIC' && (
                <span className={styles.visibilityBadge}>
                  <Lock size={10} />
                  {community.visibility.replace('_', ' ')}
                </span>
              )}
            </div>

            <p className={styles.description}>{community.description}</p>

            <div className={styles.statsRow}>
              <span><strong>{community.memberCount.toLocaleString()}</strong> members</span>
              <span>•</span>
              <span><strong>{community.discussionCount}</strong> discussions</span>
              <span>•</span>
              <span>Owner: @{community.owner?.username || 'admin'}</span>
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.joinBtn} ${isMember ? styles.joinedBtn : ''}`}
            onClick={handleJoinToggle}
          >
            {isMember ? (
              <>
                <Check size={14} />
                <span>Joined</span>
              </>
            ) : (
              <>
                <Plus size={14} />
                <span>Join Community</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabBar}>
        {(['home', 'discussions', 'members', 'about'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.toUpperCase()}
          </button>
        ))}

        {isMod && (
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'manage' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('manage')}
          >
            <Settings size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            MANAGE
          </button>
        )}
      </div>

      {/* TAB CONTENT: DISCUSSIONS (REAL-TIME CHAT & CHANNELS) */}
      {activeTab === 'discussions' && community && (
        // Socket connection is scoped to this tab, not mounted app-wide: only
        // real-time chat needs it, so every other page (and the rest of this
        // page's tabs) skips the handshake/poll traffic and client bundle cost.
        <SocketProvider>
          <CommunityChatView
            community={community}
            currentUser={user}
            initialChannelId={selectedChannel !== 'all' ? selectedChannel : null}
            onJoinToggle={handleJoinToggle}
            onChannelsUpdated={fetchCommunity}
          />
        </SocketProvider>
      )}

      {/* TAB CONTENT: HOME */}
      {activeTab === 'home' && (
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
                <button
                  type="button"
                  className={styles.textBtn}
                  onClick={() => setActiveTab('discussions')}
                >
                  View All
                </button>
              </div>

              {discussions.length > 0 ? (
                <div className={styles.discList}>
                  {discussions.slice(0, 4).map((d) => (
                    <Link key={d.id} href={`/discussions/${d.id}`} className={styles.discItem}>
                      <div>
                        <span className={styles.discChannel}>#{d.channel?.name || 'general'}</span>
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
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No discussions yet. Start the first one in the Discussions tab.</p>
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
                    onClick={() => {
                      setSelectedChannel(ch.id);
                      setActiveTab('discussions');
                    }}
                  >
                    <Hash size={13} />
                    <span>{ch.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}



      {/* TAB CONTENT: MEMBERS */}
      {activeTab === 'members' && (
        <div className={styles.membersGrid}>
          {community.members.map((m) => (
            <div key={m.id} className={styles.memberCard}>
              <div className={styles.memberAvatar}>
                {m.user.avatarUrl ? (
                  <Image
                    src={m.user.avatarUrl}
                    alt={m.user.username}
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span>{m.user.username.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className={styles.memberInfo}>
                <span className={styles.memberName}>@{m.user.username}</span>
                <span className={styles.memberRole}>{m.role}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB CONTENT: ABOUT */}
      {activeTab === 'about' && (
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
      {activeTab === 'manage' && isMod && (
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
  );
}
