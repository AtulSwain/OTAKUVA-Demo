/**
 * Creator channel limits — shared by the server (creatorService.upgradeToCreator)
 * and the sign-up form, so the form can check before an account is created.
 * Pure: safe to import in client components.
 */
export const CHANNEL_NAME_MIN = 2;
export const CHANNEL_NAME_MAX = 60;
export const CHANNEL_URL_MAX = 200;

/** The same checks upgradeToCreator makes; null when the input is fine. */
export function channelProblem(name: string, url: string): string | null {
  const n = name.replace(/\s+/g, ' ').trim();
  if (n.length < CHANNEL_NAME_MIN || n.length > CHANNEL_NAME_MAX) return `Channel name must be ${CHANNEL_NAME_MIN}–${CHANNEL_NAME_MAX} characters.`;
  const u = url.trim();
  if (u) {
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== 'https:' || u.length > CHANNEL_URL_MAX) return 'Channel link must be a full https:// address.';
    } catch {
      return 'Channel link must be a full https:// address.';
    }
  }
  return null;
}
