/**
 * OTAKUVA — cryptographically random single-use tokens (password reset,
 * email verification).
 *
 * The raw token is 256 bits of randomness from Node's CSPRNG
 * (crypto.randomBytes), sent to the user once (in the email link) and
 * never persisted. Only its SHA-256 hash is stored, so a DB read alone —
 * a leaked backup, a read-only compromise, an overly broad admin query —
 * can't be used to reset anyone's password or forge a verification.
 *
 * SHA-256 (not bcrypt/argon2) is deliberate here: the input is already a
 * high-entropy random value, not a human-chosen password, so a slow KDF
 * buys nothing — and a fast, deterministic hash is what lets confirm
 * routes look the token up by exact hash match in one indexed query
 * instead of iterating every outstanding token to compare against a
 * randomly-salted hash.
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto';

export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
export const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** A fresh raw token: 32 bytes of CSPRNG output, hex-encoded (64 chars). */
export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

/** SHA-256 hex digest of a raw token, for storage/lookup. */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Constant-time comparison of two hex digests, so a mistaken byte-by-byte
 * `===` (timing-dependent) never sneaks in at a call site. In practice
 * tokens are looked up by hash via an indexed DB query (not compared in
 * application code), but this is here for any path that does compare
 * directly.
 */
export function tokensEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
