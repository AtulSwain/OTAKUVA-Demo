'use client';

import React, { useState } from 'react';
import { User } from 'lucide-react';
import { isProviderPlaceholderImage } from '../../lib/mediaResolver';
import styles from './Entity.module.css';

/** Creator portrait, or a neutral placeholder when there's no photo, it's a provider stand-in, or it fails to load. */
export function CreatorPhoto({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const usable = src && !failed && !isProviderPlaceholderImage(src);
  return (
    <div className={styles.photo}>
      {usable ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} onError={() => setFailed(true)} />
      ) : (
        <User size={48} aria-hidden="true" />
      )}
    </div>
  );
}
