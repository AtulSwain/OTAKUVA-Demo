'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Download, Facebook, Link2, Loader2, Mail, MessageCircle, Share2, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { CARD_THEMES, renderProfileCard, profileCardBlob, type CardTheme, type ProfileCardData } from '../../lib/share/profileCard';
import { getTier } from '../../lib/badges/tiers';
import { glossFor } from '../../lib/badges/strings';
import { tierVars } from '../badges/tierStyle';
import styles from './ShareProfileSheet.module.css';

/** Brand marks lucide doesn't ship, drawn at 24×24. */
function XMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93zm-1.29 19.5h2.04L6.49 3.24H4.3z" />
    </svg>
  );
}
function TelegramMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M21.9 4.3 18.7 19.4c-.24 1.06-.87 1.32-1.76.82l-4.86-3.58-2.35 2.26c-.26.26-.48.48-.98.48l.35-4.96 9.02-8.15c.39-.35-.09-.54-.61-.2L6.36 13.1 1.56 11.6c-1.04-.33-1.06-1.04.22-1.54L20.5 2.85c.87-.32 1.63.2 1.4 1.45z" />
    </svg>
  );
}

const TARGETS: { key: string; label: string; icon: React.ReactNode; className: string; href: (url: string, text: string) => string }[] = [
  { key: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={20} aria-hidden="true" />, className: 'whatsapp', href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}` },
  { key: 'x', label: 'X', icon: <XMark />, className: 'x', href: (u, t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}` },
  { key: 'telegram', label: 'Telegram', icon: <TelegramMark />, className: 'telegram', href: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { key: 'facebook', label: 'Facebook', icon: <Facebook size={19} aria-hidden="true" />, className: 'facebook', href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { key: 'email', label: 'Email', icon: <Mail size={19} aria-hidden="true" />, className: 'email', href: (u, t) => `mailto:?subject=${encodeURIComponent('My OTAKUVA profile')}&body=${encodeURIComponent(`${t}
${u}`)}` },
];

/**
 * Share a member's profile as a designed card: a live preview (the exact
 * image that gets shared), the phone's own share sheet with the image
 * attached where supported, PNG download, copy link, and social links.
 */
export function ShareProfileSheet({ open, onClose, card }: { open: boolean; onClose: () => void; card: ProfileCardData }) {
  const { showToast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<'share' | 'download' | null>(null);
  const [copied, setCopied] = useState(false);
  const [closing, setClosing] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [theme, setTheme] = useState<CardTheme>(card.bannerUrl ? 'banner' : 'manga');

  const tier = getTier(card.tier);
  const shareText = `${card.displayName} is a ${tier.name} (${glossFor(tier.glossKey)}) reviewer on OTAKUVA`;
  const cardKey = JSON.stringify(card);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    let cancelled = false;
    setReady(false);
    renderProfileCard(canvasRef.current, card, { theme }).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // cardKey stands in for `card` so a new object with the same data doesn't redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cardKey, theme]);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 220);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  // Card follows the pointer a little (and a light sheen with it).
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
    el.style.setProperty('--sx', `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--sy', `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  const onPointerLeave = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };

  const fileName = `otakuva-${card.username.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}.png`;

  const getBlob = async () => (canvasRef.current ? profileCardBlob(canvasRef.current, card, theme) : null);

  const download = async () => {
    setBusy('download');
    try {
      const blob = await getBlob();
      if (!blob) throw new Error('Could not create the image.');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast('Card saved', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const nativeShare = async () => {
    setBusy('share');
    try {
      const blob = await getBlob();
      const file = blob ? new File([blob], fileName, { type: 'image/png' }) : null;
      const withFile = file && navigator.canShare?.({ files: [file] });
      await navigator.share(
        withFile ? { files: [file], title: 'OTAKUVA', text: `${shareText} ${card.profileUrl}` } : { title: 'OTAKUVA', text: shareText, url: card.profileUrl }
      );
    } catch (err) {
      // Closing the share sheet isn't an error.
      if ((err as Error)?.name !== 'AbortError') showToast('Sharing was not available. Try Download or Copy link.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(card.profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('Could not copy the link', 'error');
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className={`${styles.overlay} ${closing ? styles.closing : ''}`} onClick={close} role="presentation">
      <div
        className={styles.sheet}
        style={{ ...tierVars(tier), ...(tier.fill === null ? { ['--glow' as string]: 'var(--accent-primary, #7C7C86)' } : {}) }} role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={(e) => e.stopPropagation()}>
        <div className={styles.grabber} aria-hidden="true" />
        <div className={styles.head}>
          <div>
            <h2 id="share-title">Share your card</h2>
            <p className={styles.sub}>{tier.name} · Level card for @{card.username}</p>
          </div>
          <button type="button" className={styles.close} onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className={styles.stage} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
          <span className={styles.aura} aria-hidden="true" />
          <div className={`${styles.enter} ${ready ? styles.ready : ''}`}>
          <div ref={tiltRef} className={styles.tilt}>
            <canvas ref={canvasRef} className={styles.canvas} aria-label={`Profile card for ${card.displayName}`} role="img" />
            <span className={styles.sheen} aria-hidden="true" />
            {!ready && (
              <span className={styles.loading}>
                <Loader2 size={22} className={styles.spin} aria-hidden="true" />
              </span>
            )}
          </div>
          </div>
        </div>

        <div className={styles.themes} role="radiogroup" aria-label="Card style">
          {CARD_THEMES.filter((t) => t.key !== 'banner' || card.bannerUrl).map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={theme === t.key}
              className={`${styles.themeChip} ${theme === t.key ? styles.themeOn : ''}`}
              onClick={() => setTheme(t.key)}
            >
              <span className={`${styles.swatch} ${styles[`sw_${t.key}`]}`} aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.primaryRow}>
          {canNativeShare && (
            <button type="button" className={styles.primary} onClick={nativeShare} disabled={!ready || busy !== null} style={{ ['--d' as string]: '0' }}>
              {busy === 'share' ? <Loader2 size={16} className={styles.spin} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />} Share
            </button>
          )}
          <button
            type="button"
            className={canNativeShare ? styles.secondary : styles.primary}
            onClick={download}
            disabled={!ready || busy !== null}
            style={{ ['--d' as string]: '1' }}
          >
            {busy === 'download' ? <Loader2 size={16} className={styles.spin} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />} Download
          </button>
          <button type="button" className={styles.secondary} onClick={copy} style={{ ['--d' as string]: '2' }}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />} {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>

        <ul className={styles.targets} aria-label="Share to">
          {TARGETS.map((t, i) => (
            <li key={t.key} style={{ ['--d' as string]: String(i + 3) }}>
              <a href={t.href(card.profileUrl, shareText)} target="_blank" rel="noopener noreferrer" className={styles.target}>
                <span className={`${styles.mark} ${styles[t.className]}`}>{t.icon}</span>
                <span>{t.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
}
