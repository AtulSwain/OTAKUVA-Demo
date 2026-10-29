/**
 * Password rules (2026-10-28: every account signs in with username +
 * password; the SMS code only proves the phone at sign-up / reset).
 * Pure — imported by the forms and the API routes alike.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** null when acceptable, else a message to show. */
export function validatePassword(password: string, username?: string): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Use at least one letter and one number.';
  if (/^(.)\1+$/.test(password)) return 'Choose a less predictable password.';
  if (username && password.toLowerCase().includes(username.toLowerCase())) return "Your password can't contain your username.";
  return null;
}

/** 0–4, for the strength meter only (never used to accept/refuse). */
export function passwordStrength(password: string): number {
  let s = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) s++;
  if (password.length >= 12) s++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) s++;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) s++;
  return s;
}
