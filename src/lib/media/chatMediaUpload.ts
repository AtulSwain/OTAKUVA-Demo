/**
 * Uploads for chat message image attachments (DMs + anime rooms).
 *
 * Same validation/storage pipeline as comment media
 * (see commentMediaUpload.ts): every file is identified by its magic bytes —
 * never the client's MIME type or filename — decoded with sharp, bounded in
 * size/dimensions/frames, and re-encoded to WebP, which also strips
 * metadata. Unlike comment media there's no separate pending/attach step —
 * Message.mediaUrl already exists on the schema, so a chat image is uploaded
 * and posted as one message in a single request.
 */

import crypto from 'crypto';
import sharp, { Metadata } from 'sharp';
import { prisma } from '../prisma';
import { getStorageProvider } from '../storage';
import { detectImageFormat } from './commentMediaUpload';

export const CHAT_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
const MAX_EDGE_PX = 8000;
const MAX_FRAMES = 300;
const OUTPUT_MAX_EDGE_PX = 1600;

export class ChatMediaError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface UploadedChatMedia {
  url: string;
  width: number | null;
  height: number | null;
}

export async function uploadChatMedia(userId: string, file: Buffer): Promise<UploadedChatMedia> {
  if (file.length === 0) throw new ChatMediaError('The file is empty');
  if (file.length > CHAT_MEDIA_MAX_BYTES) throw new ChatMediaError('Images must be 10 MB or smaller');

  const format = detectImageFormat(file);
  if (!format) throw new ChatMediaError('Only JPG, PNG, WebP and GIF images are supported');

  let meta: Metadata;
  try {
    meta = await sharp(file, { animated: true, failOn: 'error', limitInputPixels: 60_000_000 }).metadata();
  } catch {
    throw new ChatMediaError('The image is corrupted or could not be read');
  }
  if (meta.format !== format) {
    throw new ChatMediaError('The file contents do not match an allowed image type');
  }
  const pages = meta.pages ?? 1;
  const frameHeight = meta.pageHeight ?? meta.height ?? 0;
  if (!meta.width || !frameHeight) throw new ChatMediaError('Could not determine the image size');
  if (meta.width > MAX_EDGE_PX || frameHeight > MAX_EDGE_PX) throw new ChatMediaError('Images can be at most 8000 px on a side');
  if (pages > MAX_FRAMES) throw new ChatMediaError('Animated images can have at most 300 frames');
  const animated = pages > 1;

  let pipeline = sharp(file, { animated, failOn: 'error', limitInputPixels: 60_000_000 });
  if (!animated) pipeline = pipeline.rotate();
  const output = await pipeline
    .resize(OUTPUT_MAX_EDGE_PX, OUTPUT_MAX_EDGE_PX, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  if (output.data.length > CHAT_MEDIA_MAX_BYTES) throw new ChatMediaError('The processed image is too large');
  const width = output.info.width ?? null;
  const height = (animated ? (output.info as any).pageHeight : undefined) ?? output.info.height ?? null;

  const storage = getStorageProvider();
  const uploaded = await storage.upload({
    file: output.data,
    filename: 'chat.webp',
    mimeType: 'image/webp',
    category: 'chat-media',
    entityId: userId,
    maxSizeBytes: CHAT_MEDIA_MAX_BYTES,
    customKey: `chat/${userId}/${crypto.randomBytes(12).toString('hex')}.webp`,
  });

  try {
    await prisma.mediaAsset.create({
      data: {
        userId,
        type: 'CHAT_IMAGE',
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
  } catch (err) {
    await storage.delete(uploaded.storageKey || uploaded.url).catch(() => {});
    throw err;
  }

  return { url: uploaded.url, width, height };
}
