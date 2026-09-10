'use client';

import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';
import { Film } from 'lucide-react';

interface ImageWithFallbackProps extends Omit<ImageProps, 'onError'> {
  fallbackSrc?: string;
  fallbackIcon?: React.ReactNode;
  containerClassName?: string;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  fallbackSrc,
  fallbackIcon,
  containerClassName = '',
  className = '',
  ...rest
}) => {
  const [hasError, setHasError] = useState(!src || src === '');

  if (hasError || !src) {
    if (fallbackSrc) {
      return (
        <Image
          {...rest}
          src={fallbackSrc}
          alt={alt || 'OTAKUVA Image'}
          className={className}
          onError={() => setHasError(true)}
          unoptimized
        />
      );
    }

    return (
      <div
        className={containerClassName}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'var(--surface-elevated, #1B1B1B)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted, #6F6F6F)',
        }}
        aria-label={alt || 'Image unavailable'}
      >
        {fallbackIcon || <Film size={24} />}
      </div>
    );
  }

  return (
    <Image
      {...rest}
      src={src}
      alt={alt || 'OTAKUVA Anime'}
      className={className}
      onError={() => setHasError(true)}
      unoptimized
    />
  );
};
