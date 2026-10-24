'use client';

import React, { useState } from 'react';
import styles from './UserAvatar.module.css';
import { avatarInitial, resolveAvatarUrl } from '../../lib/mediaResolver';

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
  const initials = avatarInitial(username);
  const photo = resolveAvatarUrl(avatarUrl);
  const showImage = Boolean(photo) && !failed;

  return (
    <span
      className={`${styles.avatar} ${className || ''}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) }}
      aria-hidden="true"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo as string} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        initials
      )}
    </span>
  );
};
