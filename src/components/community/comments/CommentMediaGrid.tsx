'use client';

import React, { useEffect, useState } from 'react';
import { EyeOff, ImageOff, X } from 'lucide-react';
import type { CommentMediaDto } from '../../../lib/engine/community/commentService';
import styles from './Comments.module.css';

interface CommentMediaGridProps {
  media: CommentMediaDto[];
  /** The whole comment is marked as a spoiler (already revealed by the reader). */
  forceSpoiler?: boolean;
}

/**
 * Images, memes and GIFs on a comment. Sizes come from stored dimensions so
 * nothing jumps as it loads; media marked as a spoiler stays covered until
 * the reader chooses to see it. Tapping opens a simple full-size viewer.
 */
export const CommentMediaGrid: React.FC<CommentMediaGridProps> = ({ media, forceSpoiler = false }) => {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<CommentMediaDto | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!viewing) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setViewing(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewing]);

  if (media.length === 0) return null;

  return (
    <>
      <div className={`${styles.mediaGrid} ${media.length > 1 ? styles.mediaGridMulti : ''}`}>
        {media.map((m) => {
          const hidden = (m.isSpoiler && !forceSpoiler) && !revealed.has(m.id);
          const ratio = m.width && m.height ? `${m.width} / ${m.height}` : '4 / 3';
          return (
            <div key={m.id} className={styles.mediaItem} style={{ aspectRatio: ratio }}>
              {failed.has(m.id) ? (
                <div className={styles.mediaUnavailable} role="img" aria-label="Image unavailable">
                  <ImageOff size={16} aria-hidden="true" />
                  <span>Image unavailable</span>
                </div>
              ) : hidden ? (
                <button
                  type="button"
                  className={styles.mediaSpoiler}
                  onClick={() => setRevealed((prev) => new Set(prev).add(m.id))}
                >
                  <EyeOff size={14} aria-hidden="true" />
                  <span>Spoiler {m.type === 'GIF' ? 'GIF' : 'image'} — tap to reveal</span>
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.mediaButton}
                  onClick={() => setViewing(m)}
                  aria-label={`Open ${m.type === 'GIF' ? 'GIF' : 'image'} full size`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt={m.type === 'GIF' ? 'GIF attached to comment' : 'Image attached to comment'}
                    loading="lazy"
                    decoding="async"
                    width={m.width ?? undefined}
                    height={m.height ?? undefined}
                    onError={() => setFailed((prev) => new Set(prev).add(m.id))}
                  />
                  {m.type === 'GIF' && <span className={styles.gifBadge} aria-hidden="true">GIF</span>}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {viewing && (
        <div className={styles.viewer} role="dialog" aria-modal="true" aria-label="Attachment" onClick={() => setViewing(null)}>
          <button type="button" className={styles.viewerClose} aria-label="Close" onClick={() => setViewing(null)}>
            <X size={18} aria-hidden="true" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewing.url} alt="" className={styles.viewerImage} onClick={(e) => e.stopPropagation()} />
          {viewing.source === 'GIPHY' && <span className={styles.viewerCredit}>via GIPHY</span>}
        </div>
      )}
    </>
  );
};
