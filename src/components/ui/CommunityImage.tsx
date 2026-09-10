'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { resolveMediaUrl } from '../../lib/mediaResolver';
import styles from './CommunityImage.module.css';

interface CommunityImageProps {
  src?: string | null;
  alt?: string;
  type: 'icon' | 'banner' | 'avatar';
  communityName?: string;
  className?: string;
  priority?: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
}

export const CommunityImage: React.FC<CommunityImageProps> = ({
  src,
  alt,
  type,
  communityName = 'Community',
  className = '',
  priority = false,
  fill = true,
  width,
  height,
}) => {
  const [hasError, setHasError] = useState(false);
  const resolvedSrc = resolveMediaUrl(src);

  // Reset error state if src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  // Compute initials for icon/avatar fallback
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || 'AN';
  };

  const defaultAlt =
    alt || (type === 'icon' ? `${communityName} community icon` : `${communityName} community banner`);

  // If no source or error occurred, render appropriate fallback
  if (!resolvedSrc || hasError) {
    if (type === 'banner') {
      return (
        <div
          className={`${styles.bannerFallback} ${className}`}
          role="img"
          aria-label={defaultAlt}
        >
          <div className={styles.bannerPattern} />
        </div>
      );
    }

    // Icon or Avatar Fallback: Initials
    const initials = getInitials(communityName);
    return (
      <div
        className={`${type === 'avatar' ? styles.avatarFallback : styles.iconFallback} ${className}`}
        role="img"
        aria-label={defaultAlt}
      >
        <span className={styles.initialsText}>{initials}</span>
      </div>
    );
  }

  // Safe image rendering with fallback on failure
  return (
    <div className={`${styles.imageWrapper} ${className}`}>
      <Image
        src={resolvedSrc}
        alt={defaultAlt}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        className={styles.imgElement}
        priority={priority}
        unoptimized={true} // Bypasses remote domain restriction safely
        onError={() => {
          setHasError(true);
        }}
      />
    </div>
  );
};
