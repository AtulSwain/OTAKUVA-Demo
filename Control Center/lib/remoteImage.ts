/**
 * "Use an image from a link" (2026-10-28): the control center downloads the
 * image once and stores its own copy (same pipeline as an upload), so the
 * picture can't break later because the other site blocks hotlinking,
 * changes the file, or goes away. Guards: http(s) only, public addresses
 * only (no localhost / private networks — the server is the one fetching),
 * a size cap, a time limit, and it must really be an image.
 */
import dns from 'node:dns/promises';
import net from 'node:net';
import { ControlEditError } from './editor';

const MAX_BYTES = 15 * 1024 * 1024;

function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new ControlEditError(400, "That doesn't look like a link. Paste the full address, starting with https://");
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new ControlEditError(400, 'Only http(s) links can be used.');
  if (u.username || u.password) throw new ControlEditError(400, 'Links with a username/password are not allowed.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new ControlEditError(400, `Couldn't find the website "${host}". Check the link.`);
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new ControlEditError(400, 'That link points to a private network address.');
  return u;
}

/** Downloads an image from a public link. Returns the bytes, or explains what's wrong in plain words. */
export async function downloadImage(raw: string): Promise<Buffer> {
  let url = await assertPublicUrl(raw);
  let res: Response | null = null;
  // Follow redirects ourselves so every hop is checked.
  for (let hop = 0; hop < 4; hop++) {
    res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (OTAKUVA image import)', Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8' },
    }).catch(() => null);
    if (!res) throw new ControlEditError(400, "Couldn't download from that link (the site didn't answer).");
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = await assertPublicUrl(new URL(res.headers.get('location') as string, url).toString());
      continue;
    }
    break;
  }
  if (!res || !res.ok) throw new ControlEditError(400, `That link didn't give an image (the site answered ${res?.status ?? 'nothing'}).`);
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (type.startsWith('text/html')) {
    throw new ControlEditError(400, 'That link is a web page, not an image. Right-click the picture and choose "Copy image address", then paste that.');
  }
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) throw new ControlEditError(400, 'That image is too large (max 15 MB).');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new ControlEditError(400, 'That image is too large (max 15 MB).');
  if (buf.length < 100) throw new ControlEditError(400, "That link didn't give an image.");
  return buf;
}
