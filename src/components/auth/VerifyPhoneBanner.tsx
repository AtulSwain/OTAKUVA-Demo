'use client';

import React, { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { promptPhoneVerification } from './VerifyPhonePrompt';
import styles from './VerifyPhoneBanner.module.css';

const DISMISS_KEY = 'otakuva_verify_phone_banner_dismissed';

/**
 * Shown to signed-in accounts without a verified phone — in practice,
 * legacy email/password accounts, since phone sign-up verifies on
 * creation. Rating, reviewing and posting stay locked (server-enforced by
 * requireVerifiedUser) until they verify. Dismissable for the browser session.
 */
export function VerifyPhoneBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!user || user.phoneVerified !== false || user.phoneVerificationRequired === false || dismissed) return null;

  return (
    <div className={styles.banner} role="status">
      <Smartphone size={18} className={styles.icon} aria-hidden="true" />
      <p className={styles.text}>
        <strong>Verify your phone to rate, review and post.</strong> It takes one SMS code.
      </p>
      <button type="button" className={styles.action} onClick={() => promptPhoneVerification('rate')}>
        Verify now
      </button>
      <button
        type="button"
        className={styles.close}
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem(DISMISS_KEY, '1');
          } catch {
            // storage unavailable — dismiss for this page view only
          }
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
