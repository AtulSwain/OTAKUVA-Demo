'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../../context/AuthContext';
import { SocketProvider } from '../../../../context/SocketContext';
import { ChatThread } from '../../../../components/chat/ChatThread';
import styles from './page.module.css';

export default function AnimeRoomPage() {
  const params = useParams();
  const animeId = String(params?.animeId || '');
  const { user, isLoading, openAuthModal } = useAuth();
  const [room, setRoom] = useState<{ conversationId: string; animeTitle: string; animePosterUrl: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !animeId) return;
    let cancelled = false;
    fetch(`/api/anime/${animeId}/chat`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || 'Could not open this room');
          return;
        }
        setRoom({ conversationId: data.conversationId, animeTitle: data.animeTitle, animePosterUrl: data.animePosterUrl });
      })
      .catch(() => {
        if (!cancelled) setError('Could not open this room');
      });
    return () => {
      cancelled = true;
    };
  }, [user, animeId]);

  if (!isLoading && !user) {
    return (
      <div className={styles.page}>
        <div className={styles.centerState}>
          <p>Sign in to join the live chat for this anime.</p>
          <button type="button" onClick={() => openAuthModal('login')}>Sign in</button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.centerState}>
          <p>{error}</p>
          <Link href={`/anime/${animeId}`} className={styles.backLink}>← Back to anime</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.backRow}>
        <Link href={`/anime/${animeId}`} className={styles.backLink}>← Back to anime</Link>
      </div>
      {room && (
        <SocketProvider>
          <ChatThread
            conversationId={room.conversationId}
            header={{ title: room.animeTitle, avatarUrl: room.animePosterUrl, round: false, liveMemberCount: true }}
            emptyPrompt="Be the first to chat about this"
          />
        </SocketProvider>
      )}
    </div>
  );
}
