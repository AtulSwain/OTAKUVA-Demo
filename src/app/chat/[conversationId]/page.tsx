'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { SocketProvider } from '../../../context/SocketContext';
import { ChatThread, ChatThreadHeader } from '../../../components/chat/ChatThread';
import styles from './page.module.css';

export default function ConversationPage() {
  const params = useParams();
  const conversationId = String(params?.conversationId || '');
  const { user, isLoading, openAuthModal } = useAuth();
  const [header, setHeader] = useState<ChatThreadHeader | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user || !conversationId) return;
    let cancelled = false;
    fetch('/api/conversations', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const conv = (data?.conversations || []).find((c: any) => c.id === conversationId);
        if (!conv) {
          setNotFound(true);
          return;
        }
        setHeader({
          title: conv.title || 'Conversation',
          avatarUrl: conv.avatarUrl || null,
          round: conv.type !== 'ANIME_ROOM',
          liveMemberCount: conv.type === 'ANIME_ROOM',
        });
      })
      .catch(() => setNotFound(true));
    return () => {
      cancelled = true;
    };
  }, [user, conversationId]);

  if (!isLoading && !user) {
    return (
      <div className={styles.page}>
        <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <p>Sign in to open this conversation.</p>
          <button type="button" onClick={() => openAuthModal('login')}>Sign in</button>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className={styles.page}>
        <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <p>This conversation isn&apos;t available to you.</p>
          <Link href="/chat" className={styles.backLink}>← Back to Chat</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.backRow}>
        <Link href="/chat" className={styles.backLink}>← Chat</Link>
      </div>
      {header && (
        <SocketProvider>
          <ChatThread
            conversationId={conversationId}
            header={header}
            emptyPrompt={header.round ? 'Say hello 👋' : 'Be the first to chat about this'}
          />
        </SocketProvider>
      )}
    </div>
  );
}
