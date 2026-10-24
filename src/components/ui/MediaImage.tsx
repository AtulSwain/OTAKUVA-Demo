'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { getEntitySvgPlaceholder, EntityType } from '../../lib/engine/media/svgPlaceholders';

export interface MediaImageProps {
  src?: string | null;
  secondarySrc?: string | null;
  alt: string;
  entityType?: EntityType;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
  style?: React.CSSProperties;
}

export const MediaImage: React.FC<MediaImageProps> = ({
  src,
  secondarySrc,
  alt,
  entityType = 'ANIME',
  fill = false,
  width,
  height,
  className = '',
  priority = false,
  sizes,
  style,
}) => {
  const [errorStage, setErrorStage] = useState<number>(0); // 0: primary, 1: secondary, 2: svg
  const [isLoading, setIsLoading] = useState(true);

  const fallbackSvg = getEntitySvgPlaceholder(entityType, alt);

  let activeSrc: string;
  if (errorStage === 0 && src && src.trim() !== '') {
    activeSrc = src;
  } else if (errorStage <= 1 && secondarySrc && secondarySrc.trim() !== '') {
    activeSrc = secondarySrc;
  } else {
    activeSrc = fallbackSvg;
  }

  const handleError = () => {
    setErrorStage((prev) => prev + 1);
    setIsLoading(false);
  };


  if (fill) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
        <Image
          src={activeSrc}
          alt={alt || `${entityType} Artwork`}
          fill
          priority={priority}
          sizes={sizes || '(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 16vw'}
          className={className}
          unoptimized
          onLoad={() => setIsLoading(false)}
          onError={handleError}
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
      src={activeSrc}
      alt={alt || `${entityType} Artwork`}
      width={width || 200}
      height={height || 300}
      priority={priority}
      sizes={sizes}
      className={className}
      unoptimized
      onLoad={() => setIsLoading(false)}
      onError={handleError}
      style={{
        objectFit: 'cover',
        opacity: isLoading ? 0.7 : 1,
        transition: 'opacity 0.2s ease',
        ...style,
      }}
    />
  );
};
