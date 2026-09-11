/**
 * GIF provider adapter (GIPHY). Server-side only — the API key never reaches
 * the browser, and the UI talks to /api/gifs/search, never to GIPHY.
 *
 * Enabled by setting GIPHY_API_KEY. Without it, search reports "not
 * configured" and people can still attach a GIF by uploading the file.
 *
 * A GIF attached to a comment is re-fetched here by id at post time, so the
 * only URLs ever stored are ones GIPHY returned — never a URL the client
 * sent. We store the provider reference, not a copy of the file.
 */

import { CommentError } from '../engine/community/commentError';

const GIPHY_API = 'https://api.giphy.com/v1/gifs';
const REQUEST_TIMEOUT_MS = 8000;
const GIF_ID_PATTERN = /^[A-Za-z0-9]{4,64}$/;

export interface GifResult {
  provider: 'GIPHY';
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
}

export function isGifSearchConfigured(): boolean {
  return Boolean(process.env.GIPHY_API_KEY);
}

function isGiphyMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && (u.hostname === 'giphy.com' || u.hostname.endsWith('.giphy.com'));
  } catch {
    return false;
  }
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? parseInt(value, 10) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Maps one GIPHY object to our shape, or null if it lacks usable URLs. */
export function mapGiphyObject(item: any): GifResult | null {
  const main = item?.images?.fixed_height || item?.images?.downsized || item?.images?.original;
  const preview = item?.images?.fixed_height_small || item?.images?.preview_gif || main;
  if (!item?.id || !GIF_ID_PATTERN.test(String(item.id)) || !isGiphyMediaUrl(main?.url) || !isGiphyMediaUrl(preview?.url)) {
    return null;
  }
  return {
    provider: 'GIPHY',
    id: String(item.id),
    title: typeof item.title === 'string' ? item.title.slice(0, 140) : '',
    url: main.url,
    previewUrl: preview.url,
    width: toNumber(main.width),
    height: toNumber(main.height),
  };
}

async function giphyGet(path: string, params: Record<string, string>): Promise<any> {
  const key = process.env.GIPHY_API_KEY;
  if (!key) throw new CommentError('GIF search is not configured', 503);
  const url = new URL(`${GIPHY_API}${path}`);
  url.searchParams.set('api_key', key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new CommentError('The GIF service is unavailable right now', 502);
    return await res.json();
  } catch (err) {
    if (err instanceof CommentError) throw err;
    throw new CommentError('The GIF service is unavailable right now', 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function searchGifs(query: string, limit = 24): Promise<GifResult[]> {
  const q = query.trim().slice(0, 80);
  const lim = String(Math.min(50, Math.max(1, limit)));
  const data = q
    ? await giphyGet('/search', { q, limit: lim, rating: 'pg-13' })
    : await giphyGet('/trending', { limit: lim, rating: 'pg-13' });
  const items: any[] = Array.isArray(data?.data) ? data.data : [];
  return items.map(mapGiphyObject).filter((g): g is GifResult => g !== null);
}

/** Resolves a client-chosen GIF id to provider-verified URLs, or throws. */
export async function resolveGifForAttachment(id: string): Promise<GifResult> {
  if (!GIF_ID_PATTERN.test(id)) throw new CommentError('That GIF could not be found', 400);
  const data = await giphyGet(`/${encodeURIComponent(id)}`, {});
  const gif = data ? mapGiphyObject(data.data) : null;
  if (!gif) throw new CommentError('That GIF could not be found', 400);
  return gif;
}
