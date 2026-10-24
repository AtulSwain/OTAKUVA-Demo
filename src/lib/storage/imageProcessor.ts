import sharp, { Metadata } from 'sharp';

export interface ProcessedImageResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: 'webp';
  mimeType: 'image/webp';
  size: number;
}

export class ImageProcessor {
  /**
   * Validates that an image buffer is decodable and structurally safe.
   */
  public static async validateImage(buffer: Buffer): Promise<{ valid: boolean; metadata?: Metadata; error?: string }> {
    try {
      if (!buffer || buffer.length === 0) {
        return { valid: false, error: 'Empty file buffer provided.' };
      }

      const image = sharp(buffer, { failOn: 'error' });
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        return { valid: false, error: 'Unable to determine image dimensions.' };
      }

      if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
        return { valid: false, error: `Unsupported image format: ${metadata.format || 'unknown'}. Only JPEG, PNG, and WebP are allowed.` };
      }

      return { valid: true, metadata };
    } catch (err: any) {
      return { valid: false, error: 'The file is corrupted or is not a valid image.' };
    }
  }

  /**
   * Processes a user avatar image:
   * - Square crop to 400x400 with center focus
   * - Strips EXIF metadata
   * - Converts to WebP format (quality 85)
   */
  public static async processAvatar(buffer: Buffer): Promise<ProcessedImageResult> {
    const validation = await this.validateImage(buffer);
    if (!validation.valid || !validation.metadata) {
      throw new Error(validation.error || 'Invalid avatar image file.');
    }

    const processedBuffer = await sharp(buffer)
      .rotate() // Auto-orient based on EXIF before stripping
      .resize(400, 400, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();

    const resultMetadata = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      width: resultMetadata.width || 400,
      height: resultMetadata.height || 400,
      format: 'webp',
      mimeType: 'image/webp',
      size: processedBuffer.length,
    };
  }

  /**
   * Processes a user profile banner image:
   * - Maximum width: 1920px, maximum height: 640px (maintains aspect ratio, without enlargement)
   * - Strips EXIF metadata
   * - Converts to WebP format (quality 85)
   */
  public static async processBanner(buffer: Buffer): Promise<ProcessedImageResult> {
    const validation = await this.validateImage(buffer);
    if (!validation.valid || !validation.metadata) {
      throw new Error(validation.error || 'Invalid banner image file.');
    }

    const processedBuffer = await sharp(buffer)
      .rotate()
      .resize(1920, 640, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();

    const resultMetadata = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      width: resultMetadata.width || 1920,
      height: resultMetadata.height || 640,
      format: 'webp',
      mimeType: 'image/webp',
      size: processedBuffer.length,
    };
  }

  /**
   * Article cover image: keeps the original aspect ratio (the page crops it
   * with object-fit), capped at 1600px on the long side, EXIF stripped, WebP.
   */
  public static async processArticleImage(buffer: Buffer): Promise<ProcessedImageResult> {
    const validation = await this.validateImage(buffer);
    if (!validation.valid || !validation.metadata) {
      throw new Error(validation.error || 'Invalid image file.');
    }

    const processedBuffer = await sharp(buffer)
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();

    const resultMetadata = await sharp(processedBuffer).metadata();
    return {
      buffer: processedBuffer,
      width: resultMetadata.width || 1600,
      height: resultMetadata.height || 900,
      format: 'webp',
      mimeType: 'image/webp',
      size: processedBuffer.length,
    };
  }
}
