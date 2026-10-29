import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireControl } from '@control/lib/access';
import { getStorageProvider, ImageProcessor, validateImageMagicBytes, MAX_BANNER_SIZE_BYTES } from '@/lib/storage';
import { resolveMediaUrl } from '@/lib/mediaResolver';
import { RateLimiter } from '@/lib/security/rateLimiter';
import { controlError, NO_STORE } from '@control/lib/http';
import { downloadImage } from '@control/lib/remoteImage';

const KINDS: Record<string, string> = { poster: 'POSTER', banner: 'BANNER', photo: 'COVER', logo: 'COVER', character: 'COVER' };
const bad = (error: string) => NextResponse.json({ error }, { status: 400, headers: NO_STORE });

/**
 * POST /api/control/upload — store an image for the control center, returns { url }.
 *   multipart: file, kind=poster|banner|photo|logo|character   (from the computer)
 *   JSON:      { url, kind }                                    (from a link: downloaded and stored)
 * Same checks as every other upload (real image bytes, size cap, re-encoded
 * to WebP). The returned url always loads on the site: bucket files come back
 * as the /api/media relay address (works without the media domain being set
 * up); a dev server without a reachable bucket stores under /uploads. ADMIN+.
 */
export async function POST(request: NextRequest) {
  const auth = await requireControl(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const rate = RateLimiter.checkRateLimit('MEDIA_UPLOAD', auth.id);
    if (!rate.allowed) return NextResponse.json({ error: 'Too many uploads. Wait a minute.' }, { status: 429, headers: NO_STORE });

    let buffer: Buffer;
    let kind = 'poster';
    let sourceUrl: string | null = null;
    if ((request.headers.get('content-type') || '').includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      kind = String(body?.kind || 'poster');
      if (typeof body?.url !== 'string' || !body.url.trim()) return bad('Paste an image link first.');
      sourceUrl = body.url.trim();
      buffer = await downloadImage(sourceUrl as string);
    } else {
      const form = await request.formData();
      const file = form.get('file') as File | null;
      kind = String(form.get('kind') || 'poster');
      if (!file) return bad('No image file provided.');
      if (file.size > MAX_BANNER_SIZE_BYTES) return bad('Image is too large (max 15 MB).');
      buffer = Buffer.from(await file.arrayBuffer());
    }

    const magic = validateImageMagicBytes(buffer);
    if (!magic.valid) return bad(magic.error || 'That file is not a supported image (use JPG, PNG, WebP, GIF or AVIF).');

    let processed;
    try {
      processed = kind === 'banner' ? await ImageProcessor.processBanner(buffer) : await ImageProcessor.processArticleImage(buffer);
    } catch (err) {
      return bad((err as Error).message || 'Could not process that image.');
    }

    const storage = getStorageProvider();
    const uploaded = await storage.upload({
      file: processed.buffer,
      filename: `${kind}.webp`,
      mimeType: 'image/webp',
      category: 'general',
      entityId: auth.id,
      maxSizeBytes: MAX_BANNER_SIZE_BYTES,
    });
    try {
      await prisma.mediaAsset.create({
        data: {
          userId: auth.id,
          type: KINDS[kind] || 'COVER',
          source: uploaded.provider,
          sourceUrl: sourceUrl ?? uploaded.url,
          storedUrl: uploaded.url,
          storageKey: uploaded.storageKey || null,
          width: processed.width,
          height: processed.height,
          size: processed.size,
          mimeType: 'image/webp',
          format: 'webp',
        },
      });
    } catch (dbErr) {
      await storage.delete(uploaded.url).catch(() => {});
      throw dbErr;
    }
    return NextResponse.json({ url: resolveMediaUrl(uploaded.url) || uploaded.url, width: processed.width, height: processed.height }, { headers: NO_STORE });
  } catch (e) {
    return controlError(e, '/api/control/upload');
  }
}
