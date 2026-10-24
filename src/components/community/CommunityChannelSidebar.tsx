'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, ChevronDown, X, LayoutGrid, Users, Info, Settings, LogOut, Lock, Megaphone } from 'lucide-react';
import { CommunityImage } from '../ui/CommunityImage';
import { UserAvatar } from '../ui/UserAvatar';
import BadgeChip from '../badges/BadgeChip';
import { useToast } from '../../context/ToastContext';
import { isTierKey, type TierKey } from '../../lib/badges/tiers';
import type { ChannelItem } from './CommunityChatView';
import styles from './CommunityChannelSidebar.module.css';

export type WorkspaceView = 'chat' | 'home' | 'members' | 'about' | 'manage';

interface Props {
  community: {
    slug: string;
    name: string;
    iconUrl?: string | null;
    visibility: string;
    membershipStatus?: string | null;
    isOwner: boolean;
  };
  channels: ChannelItem[];
  selectedChannelId: string | null;
  view: WorkspaceView;
  canManage: boolean;
  currentUser: { id: string; username: string; avatarUrl?: string | null } | null;
  onSelectChannel: (channel: ChannelItem) => void;
  onSelectView: (view: WorkspaceView) => void;
  onChannelCreated: (channel: ChannelItem) => void;
  onLeave: () => void;
  onSignIn: () => void;
}

export function CommunityChannelSidebar({
  community,
  channels,
  selectedChannelId,
  view,
  canManage,
  currentUser,
  onSelectChannel,
  onSelectView,
  onChannelCreated,
  onLeave,
  onSignIn,
}: Props) {
  const { showToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState('TEXT');
  const [isCreating, setIsCreating] = useState(false);

  const [myBadge, setMyBadge] = useState<{ tier: TierKey; count: number } | null>(null);

  // Viewer's own reviewer badge for the user panel.
  useEffect(() => {
    if (!currentUser?.username) {
      setMyBadge(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/users/${encodeURIComponent(currentUser.username)}/badges`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && isTierKey(d.tier)) setMyBadge({ tier: d.tier, count: d.countedReviewCount ?? 0 });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUser?.username]);

  // Close the header menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch(`/api/communities/${community.slug}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newChannelName.trim(), type: newChannelType }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.channel) {
        onChannelCreated(data.channel);
        setShowAddChannel(false);
        setNewChannelName('');
      } else {
        showToast(data?.error || 'Failed to create channel', 'error');
      }
    } catch (err) {
      console.error('Error creating channel:', err);
      showToast('Failed to create channel', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const isMember = community.membershipStatus === 'ACTIVE';
  const textChannels = channels.filter((c) => c.type !== 'ANNOUNCEMENT');
  const announcementChannels = channels.filter((c) => c.type === 'ANNOUNCEMENT');

  const navItems: { key: WorkspaceView; label: string; icon: React.ReactNode }[] = [
    { key: 'home', label: 'Overview', icon: <LayoutGrid size={18} /> },
    { key: 'members', label: 'Members & badges', icon: <Users size={18} /> },
    { key: 'about', label: 'About & rules', icon: <Info size={18} /> },
    ...(canManage ? [{ key: 'manage' as const, label: 'Manage', icon: <Settings size={18} /> }] : []),
  ];

  const renderChannel = (channel: ChannelItem) => {
    const active = view === 'chat' && selectedChannelId === channel.id;
    // OTAKUVA channels read as paths ("/general"), not Discord's "#".
    const isAnnouncement = channel.type === 'ANNOUNCEMENT';
    return (
      <li key={channel.id}>
        <button
          type="button"
          className={`${styles.item} ${active ? styles.itemActive : ''}`}
          onClick={() => onSelectChannel(channel)}
          aria-current={active ? 'page' : undefined}
        >
          {isAnnouncement ? (
            <Megaphone size={15} className={styles.itemIcon} aria-hidden="true" />
          ) : (
            <span className={styles.slash} aria-hidden="true">/</span>
          )}
          <span className={styles.itemLabel}>{channel.name}</span>
        </button>
      </li>
    );
  };

  return (
    <div className={styles.sidebar}>
      {/* Small icon + name, top-left — the only branding once inside. */}
      <div className={styles.header} ref={menuRef}>
        <button
          type="button"
          className={styles.headerBtn}
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <span className={styles.headerIcon}>
            <CommunityImage src={community.iconUrl} type="icon" communityName={community.name} />
          </span>
          <span className={styles.headerName}>{community.name}</span>
          {community.visibility !== 'PUBLIC' && <Lock size={13} className={styles.headerLock} aria-label="Private community" />}
          {menuOpen ? <X size={18} className={styles.headerChevron} /> : <ChevronDown size={18} className={styles.headerChevron} />}
        </button>

        {menuOpen && (
          <div className={styles.menu} role="menu">
            {navItems.map((n) => (
              <button
                key={n.key}
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => {
                  onSelectView(n.key);
                  setMenuOpen(false);
                }}
              >
                <span>{n.label}</span>
                {n.icon}
              </button>
            ))}
            {canManage && (
              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => {
                  setShowAddChannel(true);
                  setMenuOpen(false);
                }}
              >
                <span>Create channel</span>
                <Plus size={18} />
              </button>
            )}
            {isMember && !community.isOwner && (
              <>
                <span className={styles.menuSep} />
                <button
                  type="button"
                  role="menuitem"
                  className={`${styles.menuItem} ${styles.menuDanger}`}
                  onClick={() => {
                    setMenuOpen(false);
                    onLeave();
                  }}
                >
                  <span>Leave community</span>
                  <LogOut size={18} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.scroll}>
        <ul className={styles.list}>
          {navItems.map((n) => (
            <li key={n.key}>
              <button
                type="button"
                className={`${styles.item} ${view === n.key ? styles.itemActive : ''}`}
                onClick={() => onSelectView(n.key)}
                aria-current={view === n.key ? 'page' : undefined}
              >
                <span className={styles.itemIcon} aria-hidden="true">{n.icon}</span>
                <span className={styles.itemLabel}>{n.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <span className={styles.rule} aria-hidden="true" />

        <div className={styles.category}>
          <span>Text channels</span>
          {canManage && (
            <button type="button" className={styles.addBtn} onClick={() => setShowAddChannel(true)} aria-label="Create channel" title="Create channel">
              <Plus size={16} />
            </button>
          )}
        </div>
        <ul className={styles.list}>{textChannels.map(renderChannel)}</ul>

        {announcementChannels.length > 0 && (
          <>
            <div className={styles.category}>
              <span>Announcements</span>
            </div>
            <ul className={styles.list}>{announcementChannels.map(renderChannel)}</ul>
          </>
        )}
      </div>

      {/* "You" panel, bottom-left. */}
      <div className={styles.userPanel}>
        {currentUser ? (
          <Link href={`/profile/${encodeURIComponent(currentUser.username)}`} className={styles.userLink}>
            <UserAvatar username={currentUser.username} avatarUrl={currentUser.avatarUrl} size={34} />
            <span className={styles.userText}>
              <span className={styles.userName}>{currentUser.username}</span>
              {myBadge ? (
                <BadgeChip tier={myBadge.tier} count={myBadge.count} className={styles.userChip} />
              ) : (
                <span className={styles.userSub}>{isMember ? 'Member' : 'Visitor'}</span>
              )}
            </span>
          </Link>
        ) : (
          <button type="button" className={styles.signIn} onClick={onSignIn}>
            Sign in to chat
          </button>
        )}
      </div>

      {showAddChannel && (
        <div className={styles.modalOverlay} onClick={() => setShowAddChannel(false)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-channel-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="create-channel-title" className={styles.modalTitle}>
              Create channel
            </h2>
            <form onSubmit={handleCreateChannel} className={styles.modalForm}>
              <label className={styles.fieldLabel}>
                Channel name
                <input
                  type="text"
                  className={styles.modalInput}
                  placeholder="e.g. on-topic, spoilers, theories"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  maxLength={30}
                  autoFocus
                />
              </label>
              <label className={styles.fieldLabel}>
                Channel type
                <select className={styles.modalInput} value={newChannelType} onChange={(e) => setNewChannelType(e.target.value)}>
                  <option value="TEXT"># Text channel</option>
                  <option value="ANNOUNCEMENT">Announcement channel</option>
                </select>
              </label>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAddChannel(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn} disabled={!newChannelName.trim() || isCreating}>
                  {isCreating ? 'Creating…' : 'Create channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
