/**
 * Password rules (2026-10-28: every account signs in with username +
 * password; the SMS code only proves the phone at sign-up / reset).
 * Pure — imported by the forms and the API routes alike.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Words people pick first. A password that is just one of these plus
// numbers/symbols ("password1", "Qwerty@123", "abc12345") is refused.
const COMMON_WORDS = ['password', 'passw0rd', 'pass', 'qwerty', 'qwertyuiop', 'asdf', 'asdfgh', 'zxcvbn', 'iloveyou', 'abc', 'abcd', 'abcdef', 'letmein', 'welcome', 'admin', 'login', 'otakuva', 'anime', 'naruto', 'india', 'test'];
const COMMON_RE = new RegExp(`^[^a-z]*(${COMMON_WORDS.join('|')})[^a-z]*$`, 'i');

/** null when acceptable, else a message to show. */
export function validatePassword(password: string, username?: string): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Use at least one letter and one number.';
  if (/^(.)\1+$/.test(password)) return 'Choose a less predictable password.';
  if (username && password.toLowerCase().includes(username.toLowerCase())) return "Your password can't contain your username.";
  if (COMMON_RE.test(password)) return 'Too easy to guess. Avoid common words like “password” or “qwerty”.';
  // A run, or a run of letters followed/preceded by a run of numbers ("abcd1234", "1234abcd").
  const parts = password.match(/^([a-z]+)(\d+)$|^(\d+)([a-z]+)$/i);
  if (isRun(password) || (parts && parts.slice(1).filter(Boolean).every(isRun))) {
    return 'Too easy to guess. Avoid runs like “abc” or “1234”.';
  }
  return null;
}

/** True for a whole run of neighbouring characters, e.g. "12345678", "abcdefgh", "87654321". */
function isRun(s: string): boolean {
  if (s.length < 3) return false;
  const lower = s.toLowerCase();
  const up = '0123456789abcdefghijklmnopqrstuvwxyz';
  const down = [...up].reverse().join('');
  return up.includes(lower) || down.includes(lower);
}

export type PasswordStrength = 0 | 1 | 2 | 3;
/** Meter wording, by level (0 = nothing typed yet). */
export const PASSWORD_STRENGTH_LABEL = ['', 'Very weak', 'Moderate', 'Strong'] as const;

/**
 * The meter (2026-11-02, owner):
 *   1 Very weak — breaks a rule above, so it can't be saved
 *   2 Moderate  — allowed
 *   3 Strong    — 12+ characters with mixed case, a number and a symbol,
 *                 or 16+ with three of those
 */
export function passwordStrength(password: string, username?: string): PasswordStrength {
  if (!password) return 0;
  if (validatePassword(password, username)) return 1;
  let points = 0;
  if (password.length >= 12) points++;
  if (password.length >= 16) points++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++;
  if (/[0-9]/.test(password)) points++;
  if (/[^A-Za-z0-9]/.test(password)) points++;
  return points >= 4 ? 3 : 2;
}
