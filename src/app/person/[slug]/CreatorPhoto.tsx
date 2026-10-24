'use client';

import React, { useState } from 'react';
import { User } from 'lucide-react';
import styles from './person.module.css';

/** Photo, or a neutral placeholder when there is none or it fails to load (many old MAL photo URLs 404). */
export function CreatorPhoto({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.photo}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} onError={() => setFailed(true)} />
      ) : (
        <User size={48} aria-hidden="true" />
      )}
    </div>
  );
}
