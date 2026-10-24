'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { useAuth, type AuthResult, type OtpPurpose } from '../../context/AuthContext';
import { COUNTRY_DIAL_CODES, DEFAULT_COUNTRY_ISO, normalizePhone } from '../../lib/identity/phoneNumber';
import styles from './PhoneOtpFlow.module.css';

const RESEND_COOLDOWN_SEC = 30;
const CODE_LENGTH = 6;

interface PhoneOtpFlowProps {
  purpose: OtpPurpose;
  /** Required for purpose 'register'; sent with the code request so no SMS goes out for a name that's taken. */
  username?: string;
  /** Blocks sending a code (e.g. username not confirmed available yet). */
  canSend?: boolean;
  sendLabel?: string;
  submitLabel: string;
  autoFocus?: boolean;
  onSubmitCode: (phone: string, country: string, code: string) => Promise<AuthResult>;
  /** Machine-readable failures the parent may want to act on (USERNAME_TAKEN, PHONE_IN_USE, …). */
  onErrorCode?: (code: string) => void;
}

/**
 * Phone number → SMS code, in two steps. Shared by sign-in, sign-up and
 * linking a phone to an existing account; the server enforces every rule
 * shown here regardless.
 */
export function PhoneOtpFlow({
  purpose,
  username,
  canSend = true,
  sendLabel = 'Send code',
  submitLabel,
  autoFocus,
  onSubmitCode,
  onErrorCode,
}: PhoneOtpFlowProps) {
  const { requestOtp } = useAuth();
  const [country, setCountry] = useState(DEFAULT_COUNTRY_ISO);
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devDetail, setDevDetail] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [mockCode, setMockCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  const dialCode = COUNTRY_DIAL_CODES.find((c) => c.iso === country)?.dialCode ?? '';
  const phoneValid = normalizePhone(phone, country) !== null;

  const fail = (res: AuthResult, fallback: string) => {
    setError(res.error || fallback);
    setDevDetail(res.devDetail ?? null);
    if (res.code) onErrorCode?.(res.code);
  };

  const send = async () => {
    setError(null);
    setDevDetail(null);
    if (!phoneValid) {
      setError('Enter a valid mobile number.');
      return;
    }
    setBusy(true);
    try {
      const res = await requestOtp({ purpose, phone, country, username });
      if (!res.success) return fail(res, 'Could not send the code.');
      setDevMode(res.devMode === true);
      setMockCode(res.mockCode ?? null);
      // Test mode: fill the code in so signing in is one click.
      setCode(res.mockCode ?? '');
      setStep('code');
      setResendIn(RESEND_COOLDOWN_SEC);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (code.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code.`);
      return;
    }
    setBusy(true);
    try {
      const res = await onSubmitCode(phone, country, code);
      if (!res.success) {
        fail(res, 'That code did not work.');
        // Username/number problems can't be fixed by retyping the code.
        if (res.code === 'USERNAME_TAKEN' || res.code === 'PHONE_IN_USE') setStep('phone');
      }
    } finally {
      setBusy(false);
    }
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (step === 'phone') void send();
    else void submit();
  };

  return (
    <form className={styles.flow} onSubmit={onFormSubmit} noValidate>
      {step === 'phone' ? (
        <div className={styles.group}>
          <label className={styles.label} htmlFor={`otp-phone-${purpose}`}>
            Mobile number
          </label>
          <div className={styles.phoneRow}>
            <select
              className={styles.country}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-label="Country code"
            >
              {COUNTRY_DIAL_CODES.map((c) => (
                <option key={c.iso} value={c.iso}>
                  {c.iso} +{c.dialCode}
                </option>
              ))}
            </select>
            <input
              id={`otp-phone-${purpose}`}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              className={styles.input}
              placeholder={country === 'IN' ? '98765 43210' : 'Mobile number'}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus={autoFocus}
            />
          </div>
          <p className={styles.hint}>We&apos;ll text you a one-time code. One account per number.</p>
        </div>
      ) : (
        <div className={styles.group}>
          <div className={styles.sentRow}>
            <span className={styles.sentTo}>
              Code sent to <strong>+{dialCode} {phone.trim()}</strong>
            </span>
            <button type="button" className={styles.linkBtn} onClick={() => { setStep('phone'); setError(null); }}>
              <Pencil size={11} aria-hidden="true" /> Change
            </button>
          </div>
          <label className={styles.label} htmlFor={`otp-code-${purpose}`}>
            Verification code
          </label>
          <input
            id={`otp-code-${purpose}`}
            ref={codeRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            className={`${styles.input} ${styles.codeInput}`}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          />
          {mockCode ? (
            <p className={styles.devNote}>
              Test mode: no SMS was sent. Your code is <strong>{mockCode}</strong> (filled in for you).
            </p>
          ) : devMode ? (
            <p className={styles.devNote}>Development mode: no SMS was sent. The code is in the server log.</p>
          ) : null}
          <button type="button" className={styles.linkBtn} disabled={resendIn > 0 || busy} onClick={() => void send()}>
            {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
          </button>
        </div>
      )}

      {error && (
        <div className={styles.error} role="alert">
          {error}
          {devDetail && <span className={styles.devDetail}>{devDetail}</span>}
        </div>
      )}

      <button
        type="submit"
        className={styles.submit}
        disabled={busy || (step === 'phone' ? !canSend || !phone.trim() : code.length !== CODE_LENGTH)}
      >
        {busy ? (
          <span className={styles.loading}>
            <Loader2 size={15} className={styles.spin} aria-hidden="true" />
            <span>{step === 'phone' ? 'Sending…' : 'Verifying…'}</span>
          </span>
        ) : step === 'phone' ? (
          sendLabel
        ) : (
          submitLabel
        )}
      </button>
    </form>
  );
}
