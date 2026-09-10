'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './TrailerModal.module.css';

interface TrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  trailerUrl?: string | null;
}

export const TrailerModal: React.FC<TrailerModalProps> = ({
  isOpen,
  onClose,
  title,
  trailerUrl,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Extract YouTube ID if present
  let embedUrl = trailerUrl;
  if (trailerUrl) {
    if (trailerUrl.includes('watch?v=')) {
      const videoId = trailerUrl.split('watch?v=')[1]?.split('&')[0];
      if (videoId) embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`;
    } else if (trailerUrl.includes('youtu.be/')) {
      const videoId = trailerUrl.split('youtu.be/')[1]?.split('?')[0];
      if (videoId) embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`;
    } else if (trailerUrl.includes('/embed/')) {
      embedUrl = `${trailerUrl}?autoplay=1`;
    }
  }

  // Fallback trailer search embed if not directly available
  if (!embedUrl) {
    embedUrl = `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(`${title} official anime trailer`)}&autoplay=1`;
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{title} — Official Trailer</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close trailer">
            <X size={18} />
          </button>
        </div>

        <div className={styles.videoWrapper}>
          <iframe
            src={embedUrl}
            title={`${title} Trailer`}
            className={styles.iframe}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
};
