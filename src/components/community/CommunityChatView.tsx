'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { Megaphone, Send, Menu, Loader2, Users, Check, EyeOff } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import { UserAvatar } from '../ui/UserAvatar';
import BadgeChip from '../badges/BadgeChip';
import { isTierKey } from '../../lib/badges/tiers';
import { ChatMessage } from '../../types/socket';
import styles from './CommunityChatView.module.css';

export interface ChannelItem {
  id: string;
  name: string;
  slug: string;
  type: string;
}

interface CommunityChatViewProps {
  community: {
    slug: string;
    name: string;
    membershipStatus?: string | null;
  };
  channel: ChannelItem | null;
  currentUser: { id: string; username: string } | null;
  onJoinToggle: () => Promise<void>;
  /** Opens the channel drawer on narrow screens. */
  onOpenNav: () => void;
  isMemberListOpen: boolean;
  onToggleMemberList: () => void;
}

const ROLE_LABEL: Record<string, string> = { FOUNDER: 'Founder', ADMIN: 'Admin', MODERATOR: 'Mod' };
/** Consecutive messages from one author within this window collapse, as in Discord. */
const GROUP_WINDOW_MS = 7 * 60 * 1000;

function channelDescription(name?: string) {
  if (name === 'general') return 'General community discussion & casual chat';
  if (name === 'on-topic') return 'Anime-focused discussion, episode reactions & theories';
  if (name === 'announcements') return 'Official community announcements and updates';
  return null;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatStamp(d: Date) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return `Today at ${formatTime(d)}`;
  if (sameDay(d, yesterday)) return `Yesterday at ${formatTime(d)}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} ${formatTime(d)}`;
}

export const CommunityChatView: React.FC<CommunityChatViewProps> = ({
  community,
  channel,
  currentUser,
  onJoinToggle,
  onOpenNav,
  isMemberListOpen,
  onToggleMemberList,
}) => {
  const { socket, isConnected } = useSocket();
  const { showToast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isMember = community.membershipStatus === 'ACTIVE';
  const channelId = channel?.id;

  // Load history whenever the channel changes.
  useEffect(() => {
    if (!channelId) return;
    // Clear first so the previous channel's messages never flash in this one.
    setMessages([]);
    setLoadingMessages(true);
    let isCancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/communities/${community.slug}/chat?channelId=${channelId}`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && Array.isArray(data.messages)) setMessages(data.messages);
        }
      } catch (err) {
        console.error('Failed to load messages for channel:', err);
      } finally {
        if (!isCancelled) setLoadingMessages(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [channelId, community.slug]);

  // Socket room + listeners for the selected channel.
  useEffect(() => {
    if (!socket || !channelId) return;
    socket.emit('join_channel', channelId);

    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.channelId !== channelId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    };
    const handleUserTyping = ({ channelId: cid, username }: { channelId: string; username: string }) => {
      if (cid === channelId && username !== currentUser?.username) {
        setTypingUsers((prev) => Array.from(new Set([...prev, username])));
      }
    };
    const handleUserStopTyping = ({ channelId: cid, username }: { channelId: string; username: string }) => {
      if (cid === channelId) setTypingUsers((prev) => prev.filter((u) => u !== username));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);

    return () => {
      socket.emit('leave_channel', channelId);
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
      setTypingUsers([]);
    };
  }, [socket, channelId, currentUser?.username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loadingMessages]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (socket && channelId && currentUser?.username) {
      socket.emit('typing_start', { channelId, username: currentUser.username });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing_stop', { channelId, username: currentUser.username });
      }, 2000);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !channelId || isSending) return;
    const body = inputText.trim();
    const spoilerLevel = isSpoiler ? 'SPOILERS' : 'NO_SPOILER';

    setIsSending(true);
    setInputText('');
    setIsSpoiler(false);
    if (socket && currentUser?.username) {
      socket.emit('typing_stop', { channelId, username: currentUser.username });
    }

    try {
      const res = await fetch(`/api/communities/${community.slug}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, body, spoilerLevel }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.message) {
        const created = data.message as ChatMessage;
        setMessages((prev) => (prev.some((m) => m.id === created.id) ? prev : [...prev, created]));
      } else if (!res.ok) {
        // Give the text back rather than losing what they typed.
        setInputText(body);
        showToast(data?.error || 'Failed to send message', 'error');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setInputText(body);
      showToast('Failed to send message', 'error');
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleJoinCommunity = async () => {
    setIsJoining(true);
    try {
      await onJoinToggle();
    } finally {
      setIsJoining(false);
    }
  };

  const toggleSpoilerReveal = (msgId: string) => {
    setRevealedSpoilers((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  // Pre-compute grouping and day dividers once per message list.
  const rows = useMemo(
    () =>
      messages.map((msg, i) => {
        const date = new Date(msg.createdAt);
        const prev = i > 0 ? messages[i - 1] : null;
        const prevDate = prev ? new Date(prev.createdAt) : null;
        const newDay = !prevDate || !sameDay(prevDate, date);
        const grouped =
          !newDay &&
          !!prev &&
          prev.author?.id === msg.author?.id &&
          date.getTime() - (prevDate as Date).getTime() < GROUP_WINDOW_MS;
        return { msg, date, newDay, grouped };
      }),
    [messages]
  );

  // Channels read as paths ("/general"), not Discord's "#".
  const isAnnouncement = channel?.type === 'ANNOUNCEMENT';
  const ChannelGlyph = ({ size, className }: { size: number; className?: string }) =>
    isAnnouncement ? (
      <Megaphone size={size} className={className} aria-hidden="true" />
    ) : (
      <span className={`${styles.slashGlyph} ${className || ''}`} style={{ fontSize: size }} aria-hidden="true">
        /
      </span>
    );
  const description = channelDescription(channel?.name);

  return (
    <section className={styles.chatMain} aria-label={`/${channel?.name || 'channel'}`}>
      <header className={styles.chatHeader}>
        <button type="button" className={styles.iconBtn + ' ' + styles.navBtn} onClick={onOpenNav} aria-label="Open channels">
          <Menu size={20} />
        </button>
        <div className={styles.chatHeaderTitle}>
          <ChannelGlyph size={18} className={styles.headerGlyph} />
          <h2>{channel?.name || 'general'}</h2>
        </div>
        {description && (
          <>
            <span className={styles.chatHeaderDivider} aria-hidden="true" />
            <p className={styles.chatHeaderDesc}>{description}</p>
          </>
        )}
        <div className={styles.headerRight}>
          <span className={styles.liveBadge} title={isConnected ? 'Live updates connected' : 'Reconnecting…'}>
            <span className={`${styles.liveDot} ${isConnected ? '' : styles.liveDotOff}`} />
            {isConnected ? 'Live' : 'Syncing'}
          </span>
          <button
            type="button"
            className={`${styles.iconBtn} ${isMemberListOpen ? styles.iconBtnActive : ''}`}
            onClick={onToggleMemberList}
            aria-label={isMemberListOpen ? 'Hide member list' : 'Show member list'}
            aria-pressed={isMemberListOpen}
            title="Member list"
          >
            <Users size={20} />
          </button>
        </div>
      </header>

      <div className={styles.messagesList} role="log" aria-live="polite" aria-relevant="additions">
        {loadingMessages ? (
          <div className={styles.emptyState}>
            <Loader2 size={24} className={styles.spin} />
            <p>Connecting to channel…</p>
          </div>
        ) : (
          <>
            <div className={styles.channelIntro}>
              <div className={styles.introIcon}>
                <ChannelGlyph size={30} />
              </div>
              <h3 className={styles.introTitle}>Welcome to /{channel?.name}</h3>
              <p className={styles.introText}>This is where /{channel?.name} begins in {community.name}. Say hi — keep it kind, spoiler-tag the big stuff.</p>
            </div>

            {rows.map(({ msg, date, newDay, grouped }) => {
              const isMsgSpoiler = msg.spoilerLevel && msg.spoilerLevel !== 'NO_SPOILER';
              const isRevealed = revealedSpoilers.has(msg.id);
              const author = msg.author;
              const role = author?.role;
              const roleClass =
                role === 'FOUNDER' ? styles.nameFounder : role === 'ADMIN' ? styles.nameAdmin : role === 'MODERATOR' ? styles.nameMod : '';

              return (
                <React.Fragment key={msg.id}>
                  {newDay && (
                    <div className={styles.dayDivider} role="separator">
                      <span>{date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  )}
                  <article className={`${styles.messageRow} ${grouped ? styles.messageGrouped : ''}`}>
                    <div className={styles.gutter}>
                      {grouped ? (
                        <time className={styles.hoverTime} dateTime={msg.createdAt}>
                          {formatTime(date)}
                        </time>
                      ) : (
                        <UserAvatar username={author?.username} avatarUrl={author?.avatarUrl} size={36} />
                      )}
                    </div>

                    <div className={styles.messageContent}>
                      {!grouped && (
                        <div className={styles.messageHeader}>
                          <Link href={`/profile/${encodeURIComponent(author?.username || '')}`} className={`${styles.authorName} ${roleClass}`}>
                            {author?.username || 'Unknown user'}
                          </Link>
                          {role && ROLE_LABEL[role] && (
                            <span className={`${styles.roleTag} ${roleClass}`}>{ROLE_LABEL[role]}</span>
                          )}
                          {author?.tier && isTierKey(author.tier) && (
                            <BadgeChip tier={author.tier} count={author.reviewCount} className={styles.chip} />
                          )}
                          <time className={styles.timestamp} dateTime={msg.createdAt}>
                            {formatStamp(date)}
                          </time>
                        </div>
                      )}

                      {isMsgSpoiler && !isRevealed ? (
                        <button type="button" className={styles.spoilerShield} onClick={() => toggleSpoilerReveal(msg.id)}>
                          <EyeOff size={13} aria-hidden="true" /> Spoiler — click to reveal
                        </button>
                      ) : (
                        <div className={styles.messageBody}>{msg.body}</div>
                      )}
                    </div>
                  </article>
                </React.Fragment>
              );
            })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {isMember ? (
        <div className={styles.composerArea}>
          <div className={styles.inputWrapper}>
            <button
              type="button"
              className={`${styles.spoilerBtn} ${isSpoiler ? styles.spoilerBtnOn : ''}`}
              onClick={() => setIsSpoiler((v) => !v)}
              aria-pressed={isSpoiler}
              aria-label="Mark message as spoiler"
              title={isSpoiler ? 'Will be sent as a spoiler' : 'Mark as spoiler'}
            >
              <EyeOff size={18} />
            </button>
            <textarea
              ref={textareaRef}
              className={styles.chatTextarea}
              placeholder={`Message /${channel?.name || 'general'}`}
              aria-label={`Message /${channel?.name || 'general'}`}
              value={inputText}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={2000}
              disabled={isSending}
            />
            <button
              type="button"
              className={styles.sendBtn}
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isSending}
              aria-label="Send message"
            >
              {isSending ? <Loader2 size={16} className={styles.spin} /> : <Send size={16} />}
            </button>
          </div>
          <div className={styles.typingIndicator} aria-live="polite">
            {typingUsers.length > 0 && `${typingUsers.join(', ')} ${typingUsers.length === 1 ? 'is' : 'are'} typing…`}
          </div>
        </div>
      ) : (
        <div className={styles.joinPromptBar}>
          <div className={styles.joinPromptText}>
            <div className={styles.joinPromptTitle}>You&apos;re viewing /{channel?.name || 'general'} in read-only mode</div>
            <div className={styles.joinPromptSub}>Join {community.name} to send messages.</div>
          </div>
          <button type="button" className={styles.joinActionBtn} onClick={handleJoinCommunity} disabled={isJoining}>
            {isJoining ? <Loader2 size={14} className={styles.spin} /> : <Check size={14} />}
            <span>{isJoining ? 'Joining…' : 'Join to chat'}</span>
          </button>
        </div>
      )}
    </section>
  );
};
