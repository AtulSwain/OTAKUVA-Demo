'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Film } from 'lucide-react';
import styles from './AnimePoster.module.css';

interface AnimePosterProps {
  src?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
  width?: number;
  height?: number;
}

export const AnimePoster: React.FC<AnimePosterProps> = ({
  src,
  alt,
  className = '',
  priority = false,
  width,
  height,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  const cleanSrc = (src || '').trim();
  const isValidSrc = Boolean(cleanSrc) && !hasError && !cleanSrc.includes('example.com');

  const isFixed = typeof width === 'number' && typeof height === 'number';

  return (
    <div
      className={`${styles.posterContainer} ${className}`}
      style={isFixed ? { width, height, position: 'relative' } : undefined}
    >
      {isValidSrc ? (
        <Image
          src={cleanSrc}
          alt={alt}
          fill={!isFixed}
          width={isFixed ? width : undefined}
          height={isFixed ? height : undefined}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 18vw"
          className={`${styles.image} ${isLoading ? styles.imageLoading : styles.imageLoaded}`}
          priority={priority}
          unoptimized
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
        />
      ) : (
        <div className={styles.fallback}>
          <Film size={20} strokeWidth={1.5} className={styles.fallbackIcon} />
          <span className={styles.fallbackText}>{alt || 'OTAKUVA'}</span>
        </div>
      )}
      <div className={styles.borderOverlay} />
    </div>
  );
};
