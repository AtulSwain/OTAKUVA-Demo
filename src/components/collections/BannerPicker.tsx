'use client';

import React, { useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { promptPhoneVerification } from '../auth/VerifyPhonePrompt';
import { resolveMediaUrl } from '../../lib/mediaResolver';
import styles from './Collections.module.css';

/** What the owner picked: an uploaded image, one of the anime's banners, or nothing (automatic). */
export type BannerChoice =
  | { kind: 'upload'; assetId: string; url: string }
  | { kind: 'anime'; animeId: string; url: string }
  | null;

export interface BannerSource {
  id: string;
  title: string;
  bannerUrl: string | null;
}

/**
 * Banner chooser for a collection: upload your own image, or use the AniList
 * banner of one of the anime in it. "Automatic" (null) falls back to the
 * first anime's banner. Upload goes to POST /api/lists/banner; the server
 * only accepts the uploader's own asset or a banner of an anime in the
 * collection.
 */
export function BannerPicker({
  value,
  onChange,
  sources,
  title,
}: {
  value: BannerChoice;
  onChange: (v: BannerChoice) => void;
  /** The collection's anime; only ones with a wide banner are offered. */
  sources: BannerSource[];
  /** Shown over the preview so it looks like the real thing. */
  title?: string;
}) {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const withBanner = sources.filter((s) => s.bannerUrl);
  const automatic = withBanner[0]?.bannerUrl ?? null;
  const shown = value?.url ?? automatic;

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) return showToast('Pick an image file.', 'error');
    if (file.size > 15 * 1024 * 1024) return showToast('Image is too large. Maximum size is 15 MB.', 'error');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/lists/banner', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.code === 'PHONE_NOT_VERIFIED') return promptPhoneVerification('rate');
        throw new Error(body.error || 'Upload failed.');
      }
      onChange({ kind: 'upload', assetId: body.assetId, url: body.url });
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className={styles.picker}>
      <div className={styles.preview}>
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveMediaUrl(shown) || shown} alt="" className={styles.previewImg} />
        ) : (
          <span className={styles.previewEmpty}>Add anime or upload an image for the banner</span>
        )}
        <span className={styles.previewShade} aria-hidden="true" />
        {title && <strong className={styles.previewTitle}>{title}</strong>}
        <span className={styles.previewActions}>
          <button type="button" className={styles.previewBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 size={15} className={styles.spin} aria-hidden="true" /> : <ImagePlus size={15} aria-hidden="true" />}
            {uploading ? 'Uploading…' : 'Upload banner'}
          </button>
          {value && (
            <button type="button" className={styles.previewBtnGhost} onClick={() => onChange(null)} aria-label="Use the automatic banner">
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className={styles.hiddenInput}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>

      {withBanner.length > 0 && (
        <div className={styles.thumbs} role="radiogroup" aria-label="Banner from your anime">
          <button
            type="button"
            role="radio"
            aria-checked={value === null}
            className={`${styles.thumb} ${styles.thumbAuto} ${value === null ? styles.thumbOn : ''}`}
            onClick={() => onChange(null)}
          >
            Auto
          </button>
          {withBanner.map((s) => {
            const on = value?.kind === 'anime' && value.animeId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`${styles.thumb} ${on ? styles.thumbOn : ''}`}
                onClick={() => onChange({ kind: 'anime', animeId: s.id, url: s.bannerUrl! })}
                title={s.title}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.bannerUrl!} alt={s.title} loading="lazy" />
                {on && (
                  <span className={styles.thumbTick}>
                    <Check size={12} strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
