/**
 * Username rules — shared by the sign-up form (live feedback) and the
 * server (src/app/api/auth/register, /api/auth/username-available), so the
 * two can never disagree. Client-safe: no server imports.
 */

export const USERNAME_MIN_LENGTH = 8;
export const USERNAME_MAX_LENGTH = 24;

const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.]*$/;

/** Returns a user-facing error, or null when the username is well-formed. */
export function validateUsername(raw: string): string | null {
  const username = raw.trim();
  if (username.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters.`;
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return `Username can be at most ${USERNAME_MAX_LENGTH} characters.`;
  }
  if (!USERNAME_PATTERN.test(username)) {
    return 'Use letters, numbers, underscores and dots only, starting with a letter or number.';
  }
  return null;
}
