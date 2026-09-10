'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Hash,
  Volume2,
  Plus,
  Send,
  Lock,
  Menu,
  X,
  AlertTriangle,
  Loader2,
  Users,
  Eye,
  Check,
} from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { getAvatarUrl } from '../../lib/mediaResolver';
import { ChatMessage } from '../../types/socket';
import styles from './CommunityChatView.module.css';

interface ChannelItem {
  id: string;
  name: string;
  slug: string;
  type: string;
}

interface CommunityChatViewProps {
  community: {
    id: string;
    slug: string;
    name: string;
    channels: ChannelItem[];
    membershipStatus?: string | null;
    userRole?: string | null;
  };
  currentUser: any;
  initialChannelId?: string | null;
  onJoinToggle: () => Promise<void>;
  onChannelsUpdated?: () => void;
}

export const CommunityChatView: React.FC<CommunityChatViewProps> = ({
  community,
  currentUser,
  initialChannelId,
  onJoinToggle,
  onChannelsUpdated,
}) => {
  const { socket, isConnected } = useSocket();

  const [channels, setChannels] = useState<ChannelItem[]>(community.channels || []);
  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(() => {
    if (initialChannelId) {
      const match = community.channels?.find((c) => c.id === initialChannelId);
      if (match) return match;
    }
    return community.channels?.find((c) => c.slug === 'general') || community.channels?.[0] || null;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Spoilers revealed locally
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());

  // Typing indicators
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add Channel Modal state
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState('TEXT');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isMember = community.membershipStatus === 'ACTIVE';
  const isMod =
    currentUser?.role === 'ADMIN' ||
    community.userRole === 'OWNER' ||
    community.userRole === 'ADMIN' ||
    community.userRole === 'MODERATOR';

  // Sync channels from parent
  useEffect(() => {
    if (community.channels && community.channels.length > 0) {
      setChannels(community.channels);
      if (initialChannelId) {
        const match = community.channels.find((c) => c.id === initialChannelId);
        if (match) {
          setSelectedChannel(match);
          return;
        }
      }
      if (!selectedChannel) {
        setSelectedChannel(
          community.channels.find((c) => c.slug === 'general') || community.channels[0]
        );
      }
    }
  }, [community.channels, initialChannelId, selectedChannel]);

  // Load messages whenever selectedChannel changes
  useEffect(() => {
    if (!selectedChannel) return;

    // Reset messages immediately so previous channel's messages do not flash in the new channel
    setMessages([]);
    setLoadingMessages(true);

    let isCancelled = false;
    const fetchChannelMessages = async () => {
      try {
        const res = await fetch(
          `/api/communities/${community.slug}/chat?channelId=${selectedChannel.id}`
        );
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        }
      } catch (err) {
        console.error('Failed to load messages for channel:', err);
      } finally {
        if (!isCancelled) setLoadingMessages(false);
      }
    };

    fetchChannelMessages();

    return () => {
      isCancelled = true;
    };
  }, [selectedChannel, community.slug]);

  // Socket room joining and listeners
  useEffect(() => {
    if (!socket || !selectedChannel) return;

    // Join channel room
    socket.emit('join_channel', selectedChannel.id);

    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.channelId === selectedChannel.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    const handleUserTyping = ({ channelId, username }: { channelId: string; username: string }) => {
      if (channelId === selectedChannel.id && username !== currentUser?.username) {
        setTypingUsers((prev) => Array.from(new Set([...prev, username])));
      }
    };

    const handleUserStopTyping = ({ channelId, username }: { channelId: string; username: string }) => {
      if (channelId === selectedChannel.id) {
        setTypingUsers((prev) => prev.filter((u) => u !== username));
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);

    return () => {
      socket.emit('leave_channel', selectedChannel.id);
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
      setTypingUsers([]);
    };
  }, [socket, selectedChannel, currentUser?.username]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loadingMessages]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    // Emit typing indicator
    if (socket && selectedChannel && currentUser?.username) {
      socket.emit('typing_start', {
        channelId: selectedChannel.id,
        username: currentUser.username,
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing_stop', {
          channelId: selectedChannel.id,
          username: currentUser.username,
        });
      }, 2000);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedChannel || isSending) return;

    const body = inputText.trim();
    const spoilerLevel = isSpoiler ? 'SPOILERS' : 'NO_SPOILER';

    setIsSending(true);
    setInputText('');
    setIsSpoiler(false);

    // Stop typing indicator
    if (socket && selectedChannel && currentUser?.username) {
      socket.emit('typing_stop', {
        channelId: selectedChannel.id,
        username: currentUser.username,
      });
    }

    try {
      const res = await fetch(`/api/communities/${community.slug}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannel.id,
          body,
          spoilerLevel,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const createdMessage = data.message;
        if (createdMessage) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === createdMessage.id)) return prev;
            return [...prev, createdMessage];
          });
        }
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to send message');
      }
    } catch (err) {
      console.error('Error sending message:', err);
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

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    setIsCreatingChannel(true);
    try {
      const res = await fetch(`/api/communities/${community.slug}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChannelName.trim(),
          type: newChannelType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setChannels((prev) => [...prev, data.channel]);
        setSelectedChannel(data.channel);
        setShowAddChannelModal(false);
        setNewChannelName('');
        onChannelsUpdated?.();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create channel');
      }
    } catch (err) {
      console.error('Error creating channel:', err);
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const formatMessageDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) return `Today at ${timeStr}`;
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
    } catch {
      return '';
    }
  };

  return (
    <div className={styles.chatContainer}>
      {/* 1. DISCORD-LIKE CHANNELS SIDEBAR */}
      <aside className={`${styles.channelSidebar} ${isSidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <span>CHANNELS</span>
          {isMod && (
            <button
              type="button"
              className={styles.addChannelBtn}
              onClick={() => setShowAddChannelModal(true)}
              title="Create Channel"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        <div className={styles.channelList}>
          <div className={styles.channelCategory}>Text Channels</div>
          {channels
            .filter((c) => c.type === 'TEXT')
            .map((channel) => (
              <button
                key={channel.id}
                type="button"
                className={`${styles.channelItem} ${
                  selectedChannel?.id === channel.id ? styles.channelActive : ''
                }`}
                onClick={() => {
                  setSelectedChannel(channel);
                  setIsSidebarOpen(false);
                }}
              >
                <div className={styles.channelLeft}>
                  <Hash size={16} className={styles.channelIcon} />
                  <span>{channel.name}</span>
                </div>
              </button>
            ))}

          {channels.some((c) => c.type === 'ANNOUNCEMENT') && (
            <>
              <div className={styles.channelCategory} style={{ marginTop: '12px' }}>
                Announcements
              </div>
              {channels
                .filter((c) => c.type === 'ANNOUNCEMENT')
                .map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    className={`${styles.channelItem} ${
                      selectedChannel?.id === channel.id ? styles.channelActive : ''
                    }`}
                    onClick={() => {
                      setSelectedChannel(channel);
                      setIsSidebarOpen(false);
                    }}
                  >
                    <div className={styles.channelLeft}>
                      <Volume2 size={16} className={styles.channelIcon} />
                      <span>{channel.name}</span>
                    </div>
                  </button>
                ))}
            </>
          )}
        </div>
      </aside>

      {/* 2. CHAT MAIN VIEW */}
      <main className={styles.chatMain}>
        {/* Chat Header */}
        <div className={styles.chatHeader}>
          <div className={styles.chatHeaderLeft}>
            <button
              type="button"
              className={styles.mobileMenuBtn}
              onClick={() => setIsSidebarOpen((prev) => !prev)}
            >
              {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <div className={styles.chatHeaderTitle}>
              <Hash size={18} />
              <span>{selectedChannel?.name || 'general'}</span>
            </div>

            <div className={styles.chatHeaderDivider} />

            <div className={styles.chatHeaderDesc}>
              {selectedChannel?.name === 'general'
                ? 'General community discussion & casual chat'
                : selectedChannel?.name === 'on-topic'
                ? 'Anime-focused discussion, episode reactions & theories'
                : selectedChannel?.name === 'announcements'
                ? 'Official community announcements and updates'
                : `Community channel for #${selectedChannel?.name}`}
            </div>
          </div>

          <div className={styles.liveBadge} title="Real-time Socket.IO connection">
            <span className={styles.liveDot} />
            <span>{isConnected ? 'LIVE' : 'SYNCING'}</span>
          </div>
        </div>

        {/* Messages Timeline */}
        <div className={styles.messagesList}>
          {loadingMessages ? (
            <div className={styles.emptyState}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
              <p>Connecting to channel...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>
                <Hash size={24} />
              </div>
              <div className={styles.emptyTitle}>Welcome to #{selectedChannel?.name}!</div>
              <p>This is the start of the #{selectedChannel?.name} channel.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwner = community.userRole === 'OWNER';
              const isMsgSpoiler = msg.spoilerLevel && msg.spoilerLevel !== 'NO_SPOILER';
              const isRevealed = revealedSpoilers.has(msg.id);
              const avatar = getAvatarUrl(msg.author);

              return (
                <div key={msg.id} className={styles.messageRow}>
                  <div className={styles.avatarWrap}>
                    <Image
                      src={avatar}
                      alt={msg.author?.username || 'user'}
                      fill
                      className={styles.avatarImg}
                      unoptimized
                    />
                  </div>

                  <div className={styles.messageContent}>
                    <div className={styles.messageHeader}>
                      <span className={styles.authorName}>
                        {msg.author?.username || 'Archivist'}
                      </span>

                      {isOwner && <span className={styles.roleBadge}>Owner</span>}

                      <span className={styles.timestamp}>
                        {formatMessageDate(msg.createdAt)}
                      </span>
                    </div>

                    {isMsgSpoiler && !isRevealed ? (
                      <div
                        className={styles.spoilerShield}
                        onClick={() => toggleSpoilerReveal(msg.id)}
                      >
                        ⚠️ Spoiler content — click to reveal
                      </div>
                    ) : (
                      <div className={styles.messageBody}>{msg.body}</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 3. INPUT OR JOIN PROMPT */}
        {isMember ? (
          <div className={styles.composerArea}>
            {typingUsers.length > 0 && (
              <div className={styles.typingIndicator}>
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}

            <div className={styles.inputWrapper}>
              <textarea
                ref={textareaRef}
                className={styles.chatTextarea}
                placeholder={`Message #${selectedChannel?.name || 'general'}... (Press Enter to send)`}
                value={inputText}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isSending}
              />

              <div className={styles.composerToolbar}>
                <div className={styles.toolbarLeft}>
                  <label className={styles.spoilerToggle}>
                    <input
                      type="checkbox"
                      checked={isSpoiler}
                      onChange={(e) => setIsSpoiler(e.target.checked)}
                    />
                    <span>Tag as spoiler</span>
                  </label>
                </div>

                <button
                  type="button"
                  className={styles.sendBtn}
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isSending}
                  title="Send message"
                >
                  {isSending ? (
                    <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.joinPromptBar}>
            <div className={styles.joinPromptText}>
              <div className={styles.joinPromptTitle}>
                You are viewing this channel in read-only mode
              </div>
              <div className={styles.joinPromptSub}>
                Join {community.name} to participate in live discussions and send messages in #{selectedChannel?.name || 'general'}.
              </div>
            </div>

            <button
              type="button"
              className={styles.joinActionBtn}
              onClick={handleJoinCommunity}
              disabled={isJoining}
            >
              {isJoining ? (
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Check size={14} />
              )}
              <span>{isJoining ? 'Joining...' : 'Join Community to Chat'}</span>
            </button>
          </div>
        )}
      </main>

      {/* 4. ADD CHANNEL MODAL */}
      {showAddChannelModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddChannelModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Create Channel</div>
            <form onSubmit={handleCreateChannel} className={styles.modalForm}>
              <div>
                <label style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', display: 'block' }}>
                  CHANNEL NAME
                </label>
                <input
                  type="text"
                  className={styles.modalInput}
                  placeholder="e.g. on-topic, spoilers, theories"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  maxLength={30}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px', display: 'block' }}>
                  CHANNEL TYPE
                </label>
                <select
                  className={styles.modalInput}
                  value={newChannelType}
                  onChange={(e) => setNewChannelType(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="TEXT"># Text Channel</option>
                  <option value="ANNOUNCEMENT">📢 Announcement Channel</option>
                </select>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalCancelBtn}
                  onClick={() => setShowAddChannelModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.modalSubmitBtn}
                  disabled={!newChannelName.trim() || isCreatingChannel}
                >
                  {isCreatingChannel ? 'Creating...' : 'Create Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
