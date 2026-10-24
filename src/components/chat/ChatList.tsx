'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import styles from './ChatList.module.css';
import { resolveAvatarUrl } from '../../lib/mediaResolver';

interface ConversationRow {
  id: string;
  type: string;
  title: string | null;
  avatarUrl: string | null;
  updatedAt: string;
  unreadCount: number;
  lastMessage: { id: string; senderId: string; senderName: string; content: string; messageType: string; createdAt: string } | null;
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function previewFor(msg: ConversationRow['lastMessage']): string {
  if (!msg) return '';
  if (msg.messageType === 'GIF') return `${msg.senderName} sent a GIF`;
  if (msg.messageType === 'IMAGE') return `${msg.senderName} sent an image`;
  return msg.content;
}

export const ChatList: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState<ConversationRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/conversations', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setConversations(data?.conversations || []);
      })
      .catch(() => {
        if (!cancelled) setConversations([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Join every listed conversation's room so previews/unread counts update
  // live instead of only on the next page load.
  useEffect(() => {
    if (!socket || !conversations) return;
    conversations.forEach((c) => socket.emit('join_conversation', c.id));

    const handleNewMessage = (msg: { id: string; conversationId: string; senderId: string; sender: { username: string }; content: string; messageType: string; createdAt: string }) => {
      setConversations((prev) => {
        if (!prev) return prev;
        const next = prev.map((c) => {
          if (c.id !== msg.conversationId) return c;
          return {
            ...c,
            updatedAt: msg.createdAt,
            unreadCount: msg.senderId === user?.id ? c.unreadCount : c.unreadCount + 1,
            lastMessage: {
              id: msg.id,
              senderId: msg.senderId,
              senderName: msg.sender.username,
              content: msg.content,
              messageType: msg.messageType,
              createdAt: msg.createdAt,
            },
          };
        });
        return next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      conversations.forEach((c) => socket.emit('leave_conversation', c.id));
      socket.off('new_message', handleNewMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, conversations?.map((c) => c.id).join(','), user?.id]);

  if (conversations === null) {
    return <p className={styles.emptyState}>Loading conversations…</p>;
  }

  if (conversations.length === 0) {
    return <p className={styles.emptyState}>No conversations yet. Visit a person&apos;s profile or an anime&apos;s live chat room to start one.</p>;
  }

  return (
    <div className={styles.list}>
      {conversations.map((c) => (
        <Link key={c.id} href={`/chat/${c.id}`} className={styles.row}>
          <div className={`${styles.avatarWrap} ${c.type === 'ANIME_ROOM' ? styles.square : ''}`}>
            {resolveAvatarUrl(c.avatarUrl) && (
              <Image src={resolveAvatarUrl(c.avatarUrl) as string} alt={c.title || ''} fill sizes="44px" className={styles.avatarImg} unoptimized />
            )}
          </div>
          <div className={styles.body}>
            <div className={styles.titleRow}>
              <span className={styles.title}>{c.title || 'Conversation'}</span>
              <span className={styles.timestamp}>{relativeTime(c.lastMessage?.createdAt || c.updatedAt)}</span>
            </div>
            <div className={styles.previewRow}>
              <span className={styles.preview}>{previewFor(c.lastMessage) || 'No messages yet'}</span>
              {c.unreadCount > 0 && <span className={styles.unreadBadge}>{c.unreadCount > 9 ? '9+' : c.unreadCount}</span>}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};
