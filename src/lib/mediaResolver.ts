/**
 * Centralized media resolver for OTAKUVA user media.
 * Resolves avatar and banner URLs with reliable fallbacks and custom domain awareness.
 */

export function resolveMediaUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;

  // If pointing to media.otakuva.com, proxy through /api/media to ensure local/direct delivery
  if (trimmed.startsWith('https://media.otakuva.com/')) {
    const key = trimmed.replace('https://media.otakuva.com/', '');
    return `/api/media/${key}`;
  }

  return trimmed;
}

/**
 * Provider "no photo" stand-ins (AniList's default.jpg, MyAnimeList's
 * questionmark gif). They're placeholders, not photos — show initials instead.
 */
export function isProviderPlaceholderImage(url?: string | null): boolean {
  if (!url) return false;
  return /anilistcdn\/[a-z]+\/(?:large|medium)\/default\.(?:jpg|png)/i.test(url) || /myanimelist\.net\/images\/questionmark/i.test(url);
}

/**
 * Auto-generated avatars (the DiceBear identicons sign-up used to store) are
 * not photos the member chose — and their coloured-square mosaic read as
 * visual noise. Treat them as "no photo".
 */
export function isGeneratedAvatar(url?: string | null): boolean {
  return Boolean(url && /(^|\/\/)api\.dicebear\.com\//i.test(url));
}

/** A member's own photo, or null when they have none (or only a generated one). */
export function resolveAvatarUrl(url?: string | null): string | null {
  return isGeneratedAvatar(url) ? null : resolveMediaUrl(url);
}

/** First letter or digit of a name, upper-cased ("?" when there is none). */
export function avatarInitial(name?: string | null): string {
  const ch = (name || '').trim().replace(/[^\p{L}\p{N}]/gu, '').charAt(0);
  return ch ? ch.toUpperCase() : '?';
}

/**
 * A quiet monogram (one letter on graphite) as an inline SVG data URI, for
 * places that need an image URL rather than the <UserAvatar> component.
 */
export function monogramAvatarDataUri(name?: string | null): string {
  const letter = avatarInitial(name).replace(/[<>&"']/g, '');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">` +
    `<rect width="96" height="96" fill="#26262A"/>` +
    `<text x="48" y="50" dy=".35em" text-anchor="middle" fill="#D4D4D8" ` +
    `font-family="Inter,system-ui,-apple-system,Segoe UI,sans-serif" font-size="42" font-weight="600">${letter}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getAvatarUrl(
  user?: { avatarUrl?: string | null; username?: string; displayName?: string | null } | null
): string {
  return resolveAvatarUrl(user?.avatarUrl) || monogramAvatarDataUri(user?.displayName || user?.username);
}

export function getBannerUrl(
  user?: { bannerUrl?: string | null } | null
): string | null {
  return resolveMediaUrl(user?.bannerUrl);
}
