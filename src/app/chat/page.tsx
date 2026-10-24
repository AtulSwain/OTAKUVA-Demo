'use client';

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { SocketProvider } from '../../context/SocketContext';
import { ChatList } from '../../components/chat/ChatList';
import styles from './page.module.css';

export default function ChatListPage() {
  const { user, isLoading, openAuthModal } = useAuth();

  if (!isLoading && !user) {
    return (
      <div className={styles.page}>
        <div className={styles.signInPrompt}>
          <p>Sign in to see your direct messages and anime room chats.</p>
          <button type="button" className={styles.signInBtn} onClick={() => openAuthModal('login')}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Chat</h1>
      <p className={styles.subheading}>Direct messages and live anime room chats.</p>
      {user && (
        <SocketProvider>
          <ChatList />
        </SocketProvider>
      )}
    </div>
  );
}
