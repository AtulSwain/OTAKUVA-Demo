'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PhoneOtpFlow } from './PhoneOtpFlow';
import styles from './VerifyPhonePrompt.module.css';

const EVENT = 'otakuva:verify-phone-required';

/**
 * Open the "verify your phone first" dialog from anywhere (rate/review
 * buttons, or after the API answers PHONE_NOT_VERIFIED). The server
 * enforces the rule regardless; this lets the user fix it on the spot.
 */
export function promptPhoneVerification(reason: 'rate' | 'review' | 'post' = 'rate') {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: { reason } }));
}

const REASON_TEXT: Record<string, string> = {
  rate: 'rate anime',
  review: 'write reviews',
  post: 'post in the community',
};

/** Mounted once (AppShell). Links and verifies a phone on the signed-in account. */
export function VerifyPhonePrompt() {
  const { user, setSessionUser } = useAuth();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('rate');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onRequired = (e: Event) => {
      setReason((e as CustomEvent).detail?.reason || 'rate');
      setOpen(true);
    };
    window.addEventListener(EVENT, onRequired);
    return () => window.removeEventListener(EVENT, onRequired);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (open && user?.phoneVerified) close();
  }, [open, user?.phoneVerified, close]);

  if (!open || !user) return null;

  const verify = async (phone: string, country: string, code: string) => {
    try {
      const res = await fetch('/api/auth/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, country, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.user) return { success: false, error: data.error || 'Could not verify that code.', code: data.code };
      setSessionUser(data.user);
      showToast(data.message || 'Phone verified.', 'success');
      return { success: true };
    } catch {
      return { success: false, error: 'Could not reach the server. Check your connection and try again.' };
    }
  };

  return (
    <div className={styles.overlay} onClick={close}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-phone-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.close} onClick={close} aria-label="Close">
          <X size={18} />
        </button>

        <div className={styles.iconWrap} aria-hidden="true">
          <span className={styles.ring} />
          <Smartphone size={30} className={styles.icon} />
        </div>

        <h2 id="verify-phone-title" className={styles.title}>
          Verify your phone first
        </h2>
        <p className={styles.text}>
          To {REASON_TEXT[reason] ?? REASON_TEXT.rate}, confirm a mobile number with a one-time SMS code. Each number can
          back only one account, which keeps ratings fair.
        </p>

        <div className={styles.flowWrap}>
          <PhoneOtpFlow purpose="link" submitLabel="Verify phone" autoFocus onSubmitCode={verify} />
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={close}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
