/**
 * SMS one-time-passcode delivery and checking for phone sign-up / sign-in /
 * phone linking. Server-only.
 *
 * Production: Twilio Verify (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 * TWILIO_VERIFY_SERVICE_SID). Twilio generates, delivers, expires (10 min)
 * and rate-limits the codes itself and runs Fraud Guard against SMS
 * pumping; the code is never visible to this app. Called over its REST API
 * with fetch rather than the `twilio` SDK — two endpoints don't justify the
 * dependency.
 *
 * Development (NODE_ENV !== 'production' and Twilio unset): a local stand-in
 * that generates the code itself and writes it to the server log, so the
 * flow can be exercised without an SMS account. It is never used in
 * production — there, missing Twilio config makes every send fail with
 * `unavailable` (fail closed) rather than accepting codes nobody received.
 */

import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { logger } from '../logger';
import { isMockOtpMode } from './identityConfig';

export type OtpSendFailureReason =
  | 'invalid_number'
  | 'rate_limited'
  | 'unsupported_region'
  /** Twilio trial accounts only text numbers verified in the Twilio Console. */
  | 'trial_unverified_number'
  /** The number replied STOP to this sender. */
  | 'opted_out'
  | 'unavailable';

export type OtpSendResult =
  | { ok: true }
  | {
      ok: false;
      reason: OtpSendFailureReason;
      /** Twilio's own error, for developers: logged always, shown in the UI outside production only. */
      providerError?: { code?: number; message?: string };
    };

export type OtpCheckResult =
  | { ok: true }
  | { ok: false; reason: 'wrong_code' | 'expired' | 'too_many_attempts' | 'unavailable' };

const TWILIO_TIMEOUT_MS = 10_000;

function twilioConfig() {
  // PHONE_OTP_MODE=mock (never in production): use the local stand-in even when Twilio is set.
  if (isMockOtpMode()) return null;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !serviceSid) return null;
  return { accountSid, authToken, serviceSid };
}

/** Whether codes can be delivered at all in this environment. */
export function isOtpDeliveryAvailable(): boolean {
  return twilioConfig() !== null || process.env.NODE_ENV !== 'production';
}

/** Whether the dev stand-in (codes in the server log, no real SMS) is the active sender. */
export function isDevOtpSender(): boolean {
  return twilioConfig() === null && process.env.NODE_ENV !== 'production';
}

export async function sendOtp(phone: string): Promise<OtpSendResult> {
  const twilio = twilioConfig();
  if (twilio) return twilioSend(twilio, phone);
  if (process.env.NODE_ENV === 'production') {
    logger.error('Phone OTP requested but Twilio Verify is not configured', { component: 'identity/otpService' });
    return { ok: false, reason: 'unavailable' };
  }
  return devSend(phone);
}

export async function checkOtp(phone: string, code: string): Promise<OtpCheckResult> {
  if (!/^\d{4,10}$/.test(code)) return { ok: false, reason: 'wrong_code' };
  const twilio = twilioConfig();
  if (twilio) return twilioCheck(twilio, phone, code);
  if (process.env.NODE_ENV === 'production') return { ok: false, reason: 'unavailable' };
  return devCheck(phone, code);
}

// --- Twilio Verify ------------------------------------------------------

type TwilioConfig = NonNullable<ReturnType<typeof twilioConfig>>;

async function twilioPost(cfg: TwilioConfig, path: string, params: Record<string, string>) {
  const res = await fetch(`https://verify.twilio.com/v2/Services/${cfg.serviceSid}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(TWILIO_TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => ({}))) as { status?: string; code?: number; message?: string };
  return { httpStatus: res.status, body };
}

/** Twilio error messages often quote the destination number; keep only its last 4 digits in logs. */
const maskDigits = (s?: string) => s?.replace(/\+?\d{6,}/g, (m) => `•••${m.slice(-4)}`);

async function twilioSend(cfg: TwilioConfig, phone: string): Promise<OtpSendResult> {
  try {
    const { httpStatus, body } = await twilioPost(cfg, 'Verifications', { To: phone, Channel: 'sms' });
    if (httpStatus >= 200 && httpStatus < 300) return { ok: true };
    // https://www.twilio.com/docs/api/errors
    const providerError = { code: body.code, message: maskDigits(body.message) };
    const reason = classifySendError(httpStatus, body.code);
    // Config problems (bad credentials, deleted service) are ours to fix, not the user's: alert.
    const configProblem = httpStatus === 401 || body.code === 20003 || body.code === 20404 || body.code === 60212;
    logger.warn('Twilio Verify send failed', {
      component: 'identity/otpService',
      httpStatus,
      twilioCode: body.code,
      twilioMessage: providerError.message,
      reason,
      toSentry: configProblem || reason === 'unavailable',
    });
    return { ok: false, reason, providerError };
  } catch (err) {
    logger.error('Twilio Verify send errored', { component: 'identity/otpService', error: err as Error });
    return { ok: false, reason: 'unavailable' };
  }
}

function classifySendError(httpStatus: number, code?: number): OtpSendFailureReason {
  switch (code) {
    case 21608: // "The number is unverified. Trial accounts may only send messages to verified numbers."
    case 21219:
      return 'trial_unverified_number';
    case 21610: // recipient replied STOP
      return 'opted_out';
    case 60200: // invalid parameter (bad `To`)
    case 60205: // SMS not supported by landline
    case 21211:
    case 21614:
      return 'invalid_number';
    case 60203: // max send attempts
    case 60206:
      return 'rate_limited';
    case 60410: // geo permission / prefix blocked
    case 60605:
    case 21408:
    case 21612:
      return 'unsupported_region';
  }
  return httpStatus === 429 ? 'rate_limited' : 'unavailable';
}

async function twilioCheck(cfg: TwilioConfig, phone: string, code: string): Promise<OtpCheckResult> {
  try {
    const { httpStatus, body } = await twilioPost(cfg, 'VerificationCheck', { To: phone, Code: code });
    if (httpStatus >= 200 && httpStatus < 300) {
      // A wrong code is a 200 with status "pending", not an error.
      if (body.status === 'approved') return { ok: true };
      if (body.status === 'pending') return { ok: false, reason: 'wrong_code' };
      return { ok: false, reason: 'expired' };
    }
    // 20404: no pending verification (expired, already used, or never sent).
    if (httpStatus === 404 || body.code === 20404) return { ok: false, reason: 'expired' };
    if (body.code === 60202 || httpStatus === 429) return { ok: false, reason: 'too_many_attempts' };
    logger.warn('Twilio Verify check failed', { component: 'identity/otpService', httpStatus, twilioCode: body.code });
    return { ok: false, reason: 'unavailable' };
  } catch (err) {
    logger.error('Twilio Verify check errored', { component: 'identity/otpService', error: err as Error });
    return { ok: false, reason: 'unavailable' };
  }
}

// --- Development stand-in -----------------------------------------------
// Mirrors Verify's behaviour closely enough to develop against: 6 digits,
// 10-minute expiry, 5 check attempts, single use, a resend replaces the
// previous code. Kept on globalThis so every route bundle in `next dev`
// shares one store.

const DEV_TTL_MS = 10 * 60 * 1000;
const DEV_MAX_CHECKS = 5;

interface DevChallenge {
  codeHash: Buffer;
  expiresAt: number;
  checks: number;
  /** Only populated outside production, for tests (see peekDevOtp). */
  code: string;
}

const globalStore = globalThis as unknown as { __otakuvaDevOtp?: Map<string, DevChallenge> };
const devStore = (globalStore.__otakuvaDevOtp ??= new Map());

const sha256 = (s: string) => createHash('sha256').update(s).digest();

function devSend(phone: string): OtpSendResult {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  devStore.set(phone, { codeHash: sha256(code), expiresAt: Date.now() + DEV_TTL_MS, checks: 0, code });
  // Development only — this branch is unreachable when NODE_ENV=production.
  logger.info(`[dev OTP] code for ${phone}: ${code} (no SMS sent — set TWILIO_* to send real messages)`, {
    component: 'identity/otpService',
  });
  return { ok: true };
}

function devCheck(phone: string, code: string): OtpCheckResult {
  const challenge = devStore.get(phone);
  if (!challenge || challenge.expiresAt < Date.now()) {
    devStore.delete(phone);
    return { ok: false, reason: 'expired' };
  }
  if (challenge.checks >= DEV_MAX_CHECKS) return { ok: false, reason: 'too_many_attempts' };
  challenge.checks += 1;
  if (!timingSafeEqual(challenge.codeHash, sha256(code))) return { ok: false, reason: 'wrong_code' };
  devStore.delete(phone);
  return { ok: true };
}

/** Tests only: the code the dev stand-in last "sent" to `phone`. Always null in production. */
export function peekDevOtp(phone: string): string | null {
  if (process.env.NODE_ENV === 'production') return null;
  return devStore.get(phone)?.code ?? null;
}
