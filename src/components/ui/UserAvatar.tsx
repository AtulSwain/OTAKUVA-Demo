'use client';

import React, { useState } from 'react';
import styles from './UserAvatar.module.css';

interface UserAvatarProps {
  username?: string | null;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

/**
 * A user's avatar, or their initials when they have none (or it fails to
 * load). Comment and discussion views used to show the same stock photo of a
 * real person for every user without an avatar.
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({ username, avatarUrl, size = 28, className }) => {
  const [failed, setFailed] = useState(false);
  const name = (username || '?').trim();
  const initials = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
  const showImage = Boolean(avatarUrl) && !failed;

  return (
    <span
      className={`${styles.avatar} ${className || ''}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) }}
      aria-hidden="true"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl as string} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        initials
      )}
    </span>
  );
};
