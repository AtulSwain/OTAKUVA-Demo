/**
 * Uploads for comment/reply images, memes and GIF files.
 *
 * SELECT → PREVIEW (browser object URL, never stored) → UPLOAD here →
 * pending CommentMedia (commentId = null, owned by the uploader) → attached
 * when the comment is posted (commentService.createDiscussionComment).
 *
 * Reuses the existing storage layer (Cloudflare R2 in production via
 * getStorageProvider) and MediaAsset for the stored object. Every file is
 * checked by its magic bytes — not the client's MIME type or filename —
 * decoded by sharp, bounded in size/dimensions/frames, and re-encoded to
 * WebP (animated WebP for GIFs), which also strips metadata and anything
 * smuggled inside the original container.
 */

import crypto from 'crypto';
import sharp, { Metadata } from 'sharp';
import { prisma } from '../prisma';
import { getStorageProvider } from '../storage';
import { CommentError } from '../engine/community/commentError';

export const COMMENT_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
const MAX_EDGE_PX = 8000;
const MAX_FRAMES = 300;
const OUTPUT_MAX_EDGE_PX = 1600;
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PENDING_PER_USER = 20;

type DetectedFormat = 'jpeg' | 'png' | 'webp' | 'gif';

/** Identifies the file by its signature. Anything else is rejected. */
export function detectImageFormat(buf: Buffer): DetectedFormat | null {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  const head = buf.toString('ascii', 0, 6);
  if (head === 'GIF87a' || head === 'GIF89a') return 'gif';
  return null;
}

export interface PendingCommentMedia {
  id: string;
  type: 'IMAGE' | 'GIF';
  url: string;
  width: number | null;
  height: number | null;
}

export async function uploadCommentMedia(userId: string, file: Buffer): Promise<PendingCommentMedia> {
  if (file.length === 0) throw new CommentError('The file is empty', 400);
  if (file.length > COMMENT_MEDIA_MAX_BYTES) throw new CommentError('Images must be 10 MB or smaller', 400);

  const format = detectImageFormat(file);
  if (!format) throw new CommentError('Only JPG, PNG, WebP and GIF images are supported', 400);

  await removeStalePending(userId);
  const pending = await prisma.commentMedia.count({ where: { uploaderId: userId, commentId: null } });
  if (pending >= MAX_PENDING_PER_USER) {
    throw new CommentError('Too many unposted attachments. Post or remove some first.', 429);
  }

  // Decode for real: a file that only looks like an image fails here.
  let meta: Metadata;
  try {
    meta = await sharp(file, { animated: true, failOn: 'error', limitInputPixels: 60_000_000 }).metadata();
  } catch {
    throw new CommentError('The image is corrupted or could not be read', 400);
  }
  if (meta.format !== format && !(format === 'jpeg' && meta.format === 'jpeg')) {
    throw new CommentError('The file contents do not match an allowed image type', 400);
  }
  const pages = meta.pages ?? 1;
  const frameHeight = meta.pageHeight ?? meta.height ?? 0;
  if (!meta.width || !frameHeight) throw new CommentError('Could not determine the image size', 400);
  if (meta.width > MAX_EDGE_PX || frameHeight > MAX_EDGE_PX) throw new CommentError('Images can be at most 8000 px on a side', 400);
  if (pages > MAX_FRAMES) throw new CommentError('Animated images can have at most 300 frames', 400);
  const animated = pages > 1;

  let pipeline = sharp(file, { animated, failOn: 'error', limitInputPixels: 60_000_000 });
  if (!animated) pipeline = pipeline.rotate(); // honour EXIF orientation before it is stripped
  const output = await pipeline
    .resize(OUTPUT_MAX_EDGE_PX, OUTPUT_MAX_EDGE_PX, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  if (output.data.length > COMMENT_MEDIA_MAX_BYTES) throw new CommentError('The processed image is too large', 400);
  const width = output.info.width ?? null;
  const height = (animated ? (output.info as any).pageHeight : undefined) ?? output.info.height ?? null;

  // Upload first; only then record it. If the database write fails the
  // object is removed so nothing is left orphaned in storage.
  const storage = getStorageProvider();
  const uploaded = await storage.upload({
    file: output.data,
    filename: 'comment.webp',
    mimeType: 'image/webp',
    category: 'comment-media',
    entityId: userId,
    maxSizeBytes: COMMENT_MEDIA_MAX_BYTES,
    customKey: `comments/${userId}/${crypto.randomBytes(12).toString('hex')}.webp`,
  });

  try {
    const media = await prisma.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.create({
        data: {
          userId,
          type: 'COMMENT_IMAGE',
          source: uploaded.provider,
          sourceUrl: uploaded.url,
          storedUrl: uploaded.url,
          storageKey: uploaded.storageKey ?? null,
          width,
          height,
          size: output.data.length,
          mimeType: 'image/webp',
          format: 'webp',
        },
      });
      return tx.commentMedia.create({
        data: {
          uploaderId: userId,
          type: animated || format === 'gif' ? 'GIF' : 'IMAGE',
          source: 'UPLOAD',
          url: uploaded.url,
          width,
          height,
          mimeType: 'image/webp',
          assetId: asset.id,
        },
        select: { id: true, type: true, url: true, width: true, height: true },
      });
    });
    return { ...media, type: media.type === 'GIF' ? 'GIF' : 'IMAGE' };
  } catch (err) {
    await storage.delete(uploaded.storageKey || uploaded.url).catch(() => {});
    throw err;
  }
}

/** Removes one of the caller's own not-yet-posted uploads. */
export async function discardPendingCommentMedia(userId: string, mediaId: string) {
  const media = await prisma.commentMedia.findFirst({
    where: { id: mediaId, uploaderId: userId, commentId: null, source: 'UPLOAD' },
    include: { asset: true },
  });
  // Someone else's media, or media already posted, looks the same as absent.
  if (!media) throw new CommentError('Attachment not found', 404);
  await deletePendingRows([media]);
}

async function deletePendingRows(rows: Array<{ id: string; url: string; assetId: string | null; asset: { storageKey: string | null } | null }>) {
  const storage = getStorageProvider();
  for (const row of rows) {
    await storage.delete(row.asset?.storageKey || row.url).catch(() => {});
    await prisma.commentMedia.delete({ where: { id: row.id } }).catch(() => {});
    if (row.assetId) await prisma.mediaAsset.delete({ where: { id: row.assetId } }).catch(() => {});
  }
}

/** Uploads that were never posted within a day are removed with their objects. */
export async function removeStalePending(userId?: string) {
  const stale = await prisma.commentMedia.findMany({
    where: {
      commentId: null,
      source: 'UPLOAD',
      createdAt: { lt: new Date(Date.now() - PENDING_TTL_MS) },
      ...(userId ? { uploaderId: userId } : {}),
    },
    include: { asset: true },
    take: 200,
  });
  await deletePendingRows(stale);
  return stale.length;
}
