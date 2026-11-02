/**
 * Control-center gate (2026-11-02, owner): two steps to get in.
 *
 *  1. The owner's key, typed into the normal sign-in form's password box
 *     (any username). The key itself is never in the code: only its SHA-256
 *     lives in the server env (`CONTROL_GATE_KEY_SHA256`). A match sets a
 *     signed httpOnly gate cookie and sends the browser to /control.
 *  2. /control's own sign-in: an ADMIN / SUPER_ADMIN username + password.
 *
 * Without the gate cookie /control and every /api/control route answer 404,
 * so the console's existence isn't revealed. Fails closed in production: no
 * hash configured means nobody passes step one.
 */
import { createHash, timingSafeEqual } from 'crypto';
import { signControlGatePass, verifyControlGatePass } from '@/lib/auth';

export const CONTROL_GATE_COOKIE = 'otakuva_cgate';
export const CONTROL_GATE_TTL_SEC = 12 * 60 * 60; // 12 hours

const configuredHash = () => (process.env.CONTROL_GATE_KEY_SHA256 || '').trim().toLowerCase();

/** The gate applies whenever a key is configured, and always in production. */
export function isControlGateEnforced(): boolean {
  return Boolean(configuredHash()) || process.env.NODE_ENV === 'production';
}

/** True only when `candidate` is the owner's key (constant-time compare). */
export function isControlGateKey(candidate: unknown): boolean {
  const expected = configuredHash();
  if (!/^[0-9a-f]{64}$/.test(expected) || typeof candidate !== 'string' || !candidate.trim()) return false;
  const got = createHash('sha256').update(candidate.trim(), 'utf8').digest();
  return timingSafeEqual(got, Buffer.from(expected, 'hex'));
}

export const issueControlGatePass = () => signControlGatePass(CONTROL_GATE_TTL_SEC);

/** Whether a request/page carrying this cookie value has passed step one. */
export function hasControlGate(cookieValue: string | undefined | null): boolean {
  if (!isControlGateEnforced()) return true;
  return verifyControlGatePass(cookieValue);
}

export const controlGateCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: CONTROL_GATE_TTL_SEC,
});
