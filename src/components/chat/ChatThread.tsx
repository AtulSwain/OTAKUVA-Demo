'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { MessageBubble, ChatMessageItem, TimeDivider, formatTimeDivider } from './MessageBubble';
import { MessageComposer, OutgoingMessage } from './MessageComposer';
import styles from './ChatThread.module.css';
import { resolveAvatarUrl } from '../../lib/mediaResolver';

const TIME_GAP_DIVIDER_MS = 15 * 60 * 1000;

export interface ChatThreadHeader {
  title: string;
  avatarUrl: string | null;
  /** DMs use a circular avatar; anime rooms use a squared poster thumbnail. */
  round: boolean;
  liveMemberCount?: boolean;
}

interface ChatThreadProps {
  conversationId: string;
  header: ChatThreadHeader;
  emptyPrompt: string;
}

export const ChatThread: React.FC<ChatThreadProps> = ({ conversationId, header, emptyPrompt }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/conversations/${conversationId}/messages`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.messages) setMessages(data.messages);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!socket || !conversationId) return;
    socket.emit('join_conversation', conversationId);

    const handleNewMessage = (msg: ChatMessageItem & { conversationId: string }) => {
      if (msg.conversationId !== conversationId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    };

    const handleMemberCount = (payload: { conversationId: string; count: number }) => {
      if (payload.conversationId === conversationId) setMemberCount(payload.count);
    };

    const handleTyping = ({ conversationId: cid, username }: { conversationId: string; username: string }) => {
      if (cid === conversationId && username !== user?.username) {
        setTypingUsers((prev) => Array.from(new Set([...prev, username])));
      }
    };

    const handleStopTyping = ({ conversationId: cid, username }: { conversationId: string; username: string }) => {
      if (cid === conversationId) setTypingUsers((prev) => prev.filter((u) => u !== username));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('conversation_member_count', handleMemberCount);
    socket.on('conversation_user_typing', handleTyping);
    socket.on('conversation_user_stop_typing', handleStopTyping);

    return () => {
      socket.emit('leave_conversation', conversationId);
      socket.off('new_message', handleNewMessage);
      socket.off('conversation_member_count', handleMemberCount);
      socket.off('conversation_user_typing', handleTyping);
      socket.off('conversation_user_stop_typing', handleStopTyping);
      setTypingUsers([]);
    };
  }, [socket, conversationId, user?.username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const handleSend = async (payload: OutgoingMessage) => {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.message) {
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
    }
  };

  const handleTypingChange = (isTyping: boolean) => {
    if (!socket || !user?.username) return;
    socket.emit(isTyping ? 'conversation_typing_start' : 'conversation_typing_stop', {
      conversationId,
      username: user.username,
    });
  };

  return (
    <div className={styles.thread}>
      <div className={styles.header}>
        <div className={`${styles.headerAvatarWrap} ${header.round ? styles.round : ''}`}>
          {resolveAvatarUrl(header.avatarUrl) && (
            <Image src={resolveAvatarUrl(header.avatarUrl) as string} alt={header.title} fill sizes="32px" className={styles.headerAvatarImg} unoptimized />
          )}
        </div>
        <div className={styles.headerText}>
          <span className={styles.headerTitle}>{header.title}</span>
          {header.liveMemberCount && memberCount !== null && (
            <span className={styles.headerMeta}>{memberCount} watching live</span>
          )}
          {typingUsers.length > 0 && (
            <span className={styles.headerMeta}>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…</span>
          )}
        </div>
      </div>

      <div className={styles.messages}>
        {!loading && messages.length === 0 && <p className={styles.emptyState}>{emptyPrompt}</p>}
        {messages.map((msg, index) => {
          const prev = messages[index - 1];
          const isOwn = msg.senderId === user?.id;
          const showAvatar = !prev || prev.senderId !== msg.senderId;
          const showDivider = !prev || new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > TIME_GAP_DIVIDER_MS;
          return (
            <React.Fragment key={msg.id}>
              {showDivider && <TimeDivider label={formatTimeDivider(msg.createdAt)} />}
              <MessageBubble message={msg} isOwn={isOwn} showAvatar={showAvatar && !isOwn} />
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <MessageComposer onSend={handleSend} onTypingChange={handleTypingChange} />
    </div>
  );
};
