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

export function getAvatarUrl(
  user?: { avatarUrl?: string | null; username?: string } | null
): string {
  const resolved = resolveMediaUrl(user?.avatarUrl);
  if (resolved) {
    return resolved;
  }

  const seed = user?.username ? encodeURIComponent(user.username.toLowerCase()) : 'otakuva';
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}`;
}

export function getBannerUrl(
  user?: { bannerUrl?: string | null } | null
): string | null {
  return resolveMediaUrl(user?.bannerUrl);
}
