'use client';

import React from 'react';
import Image from 'next/image';
import { getAvatarUrl } from '../../lib/mediaResolver';
import styles from './MessageBubble.module.css';
import { resolveMediaUrl } from '../../lib/mediaResolver';

export interface ChatMessageItem {
  id: string;
  senderId: string;
  sender: { id: string; username: string; avatarUrl?: string | null };
  content: string;
  messageType: string;
  mediaUrl?: string | null;
  createdAt: string;
}

interface MessageBubbleProps {
  message: ChatMessageItem;
  isOwn: boolean;
  showAvatar: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn, showAvatar }) => {
  const isMedia = message.messageType === 'GIF' || message.messageType === 'IMAGE' || message.messageType === 'MEME';

  return (
    <div className={`${styles.row} ${isOwn ? styles.rowOwn : ''}`}>
      <div className={styles.avatarSlot}>
        {!isOwn && showAvatar && (
          <div className={styles.avatarWrap}>
            <Image
              src={getAvatarUrl(message.sender)}
              alt={message.sender.username}
              fill
              sizes="26px"
              className={styles.avatarImg}
              unoptimized
            />
          </div>
        )}
      </div>

      <div className={styles.bubbleCol}>
        {!isOwn && showAvatar && <span className={styles.senderName}>{message.sender.username}</span>}

        {isMedia && message.mediaUrl ? (
          <div className={`${styles.bubble} ${styles.bubbleMedia} ${isOwn ? styles.bubbleOwn : styles.bubbleOther}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveMediaUrl(message.mediaUrl) || undefined} alt="" className={styles.mediaImg} loading="lazy" />
          </div>
        ) : (
          <div className={`${styles.bubble} ${isOwn ? styles.bubbleOwn : styles.bubbleOther}`}>
            {message.content}
          </div>
        )}
      </div>
    </div>
  );
};

export const TimeDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className={styles.timeDivider}>{label}</div>
);

export function formatTimeDivider(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isToday) return time;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}
