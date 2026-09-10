'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { getEntitySvgPlaceholder } from '../../lib/engine/media/svgPlaceholders';

interface AnimeImageProps {
  src?: string | null;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
  style?: React.CSSProperties;
}

export const AnimeImage: React.FC<AnimeImageProps> = ({
  src,
  alt,
  fill,
  width,
  height,
  className = '',
  priority = false,
  sizes,
  style,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fallbackPlaceholder = getEntitySvgPlaceholder('ANIME', alt);

  // Filter out bad/missing URLs
  const cleanSrc =
    !hasError && src && typeof src === 'string' && src.trim() !== '' && !src.includes('example.com')
      ? src
      : fallbackPlaceholder;

  if (fill) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
        <Image
          src={cleanSrc}
          alt={alt || 'Anime Artwork'}
          fill
          priority={priority}
          sizes={sizes || '(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw'}
          className={className}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
          style={{
            objectFit: 'cover',
            opacity: isLoading ? 0.7 : 1,
            transition: 'opacity 0.2s ease',
          }}
        />
      </div>
    );
  }

  return (
    <Image
      src={cleanSrc}
      alt={alt || 'Anime Artwork'}
      width={width || 200}
      height={height || 300}
      priority={priority}
      sizes={sizes}
      className={className}
      onLoad={() => setIsLoading(false)}
      onError={() => {
        setHasError(true);
        setIsLoading(false);
      }}
      style={{
        objectFit: 'cover',
        opacity: isLoading ? 0.7 : 1,
        transition: 'opacity 0.2s ease',
        ...style,
      }}
    />
  );
};
