import { URL } from 'url';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const MAX_ICON_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_BANNER_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Validates magic numbers of image buffer to ensure actual file type matches safe formats.
 */
export function validateImageMagicBytes(buffer: Buffer): { valid: boolean; detectedMime?: string; error?: string } {
  if (!buffer || buffer.length < 12) {
    return { valid: false, error: 'File is too small to be a valid image' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedMime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedMime: 'image/png' };
  }

  // WebP: RIFF .... WEBP
  const isRiff =
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  const isWebp =
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  if (isRiff && isWebp) {
    return { valid: true, detectedMime: 'image/webp' };
  }

  return { valid: false, error: 'Unsupported or corrupted image format. Please use JPEG, PNG, or WebP.' };
}

/**
 * Validates external image URL with strict SSRF defenses.
 */
export function validateExternalImageUrl(inputUrl: string): { valid: boolean; normalizedUrl?: string; error?: string } {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { valid: false, error: 'Enter a valid image URL.' };
  }

  const trimmed = inputUrl.trim();

  // Reject unsafe schemes
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:')
  ) {
    return { valid: false, error: 'Executable, data, or local protocol URLs are not permitted.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Enter a valid image URL.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTP and HTTPS URLs are supported.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // SSRF Protection: Reject private/internal IPs and hostnames
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost');

  if (isLocalhost) {
    return { valid: false, error: 'Internal and local addresses are not permitted.' };
  }

  // Check IPv4 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
  const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipMatch) {
    const octet1 = parseInt(ipMatch[1], 10);
    const octet2 = parseInt(ipMatch[2], 10);

    if (
      octet1 === 10 ||
      (octet1 === 172 && octet2 >= 16 && octet2 <= 31) ||
      (octet1 === 192 && octet2 === 168) ||
      (octet1 === 169 && octet2 === 254) ||
      octet1 === 127 ||
      octet1 === 0
    ) {
      return { valid: false, error: 'Private and link-local IP addresses are not permitted.' };
    }
  }

  return { valid: true, normalizedUrl: trimmed };
}
