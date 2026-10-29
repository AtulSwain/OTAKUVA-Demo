'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, Loader2, Link2, Check } from 'lucide-react';
import styles from './control.module.css';

/** Our own stored images (uploads / bucket relay) — already safe to keep. */
const isStored = (v: string) => /^\/(uploads|api\/media)\//.test(v);

/**
 * Pick an image: upload a file from the computer, or paste a link and press
 * "Use this link" (the server downloads it and keeps its own copy, so it
 * can't break later). Either way `onChange` gets an address that loads on
 * the site.
 */
export function ImageField({
  label,
  value,
  onChange,
  kind,
  shape = 'poster',
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  kind: 'poster' | 'banner' | 'photo' | 'logo' | 'character';
  shape?: 'poster' | 'banner' | 'square';
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'file' | 'link' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  const store = async (init: RequestInit, mode: 'file' | 'link') => {
    setError(null);
    setOk(null);
    setBusy(mode);
    try {
      const res = await fetch('/api/control/upload', { method: 'POST', ...init });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not save that image.');
      setBroken(false);
      onChange(data.url);
      setOk(mode === 'file' ? 'Uploaded. Press Save to keep it.' : 'Image copied from the link. Press Save to keep it.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const uploadFile = (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    void store({ body: fd }, 'file');
  };
  const useLink = () => void store({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: value.trim(), kind }) }, 'link');

  const pastedLink = Boolean(value.trim()) && !isStored(value.trim());

  return (
    <div className={styles.imageField}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.imageRow}>
        <div className={`${styles.preview} ${styles[`preview_${shape}`]}`}>
          {value && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" onError={() => setBroken(true)} onLoad={() => setBroken(false)} />
          ) : (
            <span>{value ? "Can't show" : 'No image'}</span>
          )}
        </div>
        <div className={styles.imageControls}>
          <input
            className={styles.input}
            value={value}
            onChange={(e) => {
              setBroken(false);
              setOk(null);
              setError(null);
              onChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pastedLink) {
                e.preventDefault();
                useLink();
              }
            }}
            placeholder="Paste an image link, or choose a file"
            inputMode="url"
            spellCheck={false}
          />
          <div className={styles.imageBtns}>
            <button type="button" className={styles.secondary} onClick={() => fileRef.current?.click()} disabled={busy !== null}>
              {busy === 'file' ? <Loader2 size={14} className={styles.spin} /> : <Upload size={14} />} Choose from computer
            </button>
            {pastedLink && (
              <button type="button" className={styles.secondary} onClick={useLink} disabled={busy !== null}>
                {busy === 'link' ? <Loader2 size={14} className={styles.spin} /> : <Link2 size={14} />} Use this link
              </button>
            )}
            {value && (
              <button
                type="button"
                className={styles.ghost}
                onClick={() => {
                  setOk(null);
                  setError(null);
                  onChange('');
                }}
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
            }}
          />
          {pastedLink && !error && !ok && <p className={styles.fieldHint}>Press “Use this link” so OTAKUVA keeps its own copy of the image.</p>}
          {broken && pastedLink && !error && <p className={styles.error}>This link doesn&apos;t open as an image here — try “Use this link”, or copy the image address instead of the page address.</p>}
          {ok && (
            <p className={styles.okMsg}>
              <Check size={13} /> {ok}
            </p>
          )}
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
