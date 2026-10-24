import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { StorageProvider, UploadOptions, UploadResult } from './types';

/** R2 refused the credentials (401/403) — retrying won't help. */
export class R2AuthError extends Error {
  readonly code = 'R2_AUTH';
  constructor(message: string) {
    super(message);
    this.name = 'R2AuthError';
  }
}

export class R2StorageProvider implements StorageProvider {
  public name = 'r2' as const;
  private client: S3Client | null = null;
  private bucket: string;
  private publicBaseUrl: string;

  constructor() {
    const endpoint =
      process.env.R2_ENDPOINT ||
      'https://0633c7571e5c9ccb6f49c6f197b707c0.r2.cloudflarestorage.com';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';

    this.bucket = process.env.R2_BUCKET_NAME || 'otakuva-media';
    this.publicBaseUrl = (process.env.MEDIA_PUBLIC_URL || 'https://media.otakuva.com').replace(/\/+$/, '');

    // Only instantiate S3Client if credentials are provided
    if (accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
  }

  /**
   * Returns true if Cloudflare R2 credentials are configured on the server.
   */
  public isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Generates a collision-resistant, versioned asset key.
   * e.g., "avatars/a7f2918b9c.webp" or "banners/b8e192f801.webp"
   */
  private generateStorageKey(category: string, ext = 'webp', customKey?: string): string {
    if (customKey) {
      // Clean custom key of unsafe characters and path traversal
      const cleaned = customKey.replace(/^\/+/, '').replace(/\.\./g, '');
      return cleaned;
    }

    const uniqueId = crypto.randomBytes(12).toString('hex');
    const folder = category.includes('banner')
      ? 'banners'
      : category.includes('avatar') || category === 'community-icon'
      ? 'avatars'
      : 'media';

    return `${folder}/${uniqueId}.${ext}`;
  }

  /**
   * Uploads an image buffer directly to the Cloudflare R2 bucket.
   */
  public async upload(options: UploadOptions): Promise<UploadResult> {
    if (!this.client) {
      throw new Error(
        'Cloudflare R2 credentials (R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY) are not configured.'
      );
    }

    const { file, mimeType, category, maxSizeBytes, customKey } = options;

    if (maxSizeBytes && file.length > maxSizeBytes) {
      throw new Error(
        `File is too large. Maximum allowed size is ${Math.round(maxSizeBytes / (1024 * 1024))} MB.`
      );
    }

    // Determine extension from mimeType
    let ext = 'webp';
    if (mimeType === 'image/png') ext = 'png';
    else if (mimeType === 'image/jpeg') ext = 'jpg';

    const storageKey = this.generateStorageKey(category, ext, customKey);

    // Bounded retry with exponential backoff for transient network issues
    let lastError: any = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
          Body: file,
          ContentType: mimeType,
          // 1 year immutable edge cache for versioned object keys
          CacheControl: 'public, max-age=31536000, immutable',
        });

        await this.client.send(command);

        const publicUrl = this.getPublicUrl(storageKey);
        const filename = storageKey.split('/').pop() || storageKey;

        return {
          url: publicUrl,
          filename,
          size: file.length,
          mimeType,
          provider: 'r2',
          storageKey,
        };
      } catch (err: any) {
        lastError = err;
        // Do not retry authorization failures — they can't succeed on retry.
        // R2 answers a revoked/rolled API token with 401 "Unauthorized",
        // which used to fall through to three backed-off retries.
        const status = err.$metadata?.httpStatusCode;
        if (err.name === 'InvalidAccessKeyId' || err.name === 'SignatureDoesNotMatch' || status === 401 || status === 403) {
          throw new R2AuthError(
            `Cloudflare R2 rejected the configured credentials (HTTP ${status ?? '?'}: ${err.name}). ` +
              'The R2 API token in R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY is invalid, revoked, or lacks access to this bucket — create a new token in the Cloudflare dashboard.'
          );
        }

        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 200 + Math.floor(Math.random() * 100);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw new Error(`Cloudflare R2 upload failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown network error'}`);
  }

  /**
   * Deletes an object from Cloudflare R2 by key or full public URL.
   */
  public async delete(publicUrlOrKey: string): Promise<boolean> {
    if (!this.client || !publicUrlOrKey) {
      return false;
    }

    try {
      const storageKey = this.extractStorageKey(publicUrlOrKey);
      if (!storageKey) return false;

      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      });

      await this.client.send(command);
      return true;
    } catch (err: any) {
      console.error('Error deleting object from Cloudflare R2:', err.message || err);
      return false;
    }
  }

  /**
   * Extracts the storage key from a full public URL or relative path.
   */
  public extractStorageKey(urlOrKey: string): string | null {
    if (!urlOrKey) return null;

    let key = urlOrKey.trim();

    // If starts with custom domain, strip it
    if (this.publicBaseUrl && key.startsWith(this.publicBaseUrl)) {
      key = key.substring(this.publicBaseUrl.length);
    } else {
      // Check if it's an R2 cloudflarestorage or r2.dev domain
      const match = key.match(/^https?:\/\/[^\/]+\/(.+)$/);
      if (match) {
        key = match[1];
      }
    }

    // Strip leading slashes
    key = key.replace(/^\/+/, '');

    // Path traversal defense
    if (key.includes('..')) {
      return null;
    }

    return key;
  }

  /**
   * Constructs the public CDN URL for a storage key.
   */
  public getPublicUrl(storageKey: string): string {
    const cleanKey = storageKey.replace(/^\/+/, '');
    return `${this.publicBaseUrl}/${cleanKey}`;
  }
}
