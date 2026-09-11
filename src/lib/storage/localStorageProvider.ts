import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { StorageProvider, UploadOptions, UploadResult } from './types';
import { validateImageMagicBytes } from './imageValidator';

export class LocalStorageProvider implements StorageProvider {
  public name = 'local' as const;
  private uploadsRoot: string;

  constructor() {
    // LOCAL_UPLOADS_ROOT lets tests keep their files out of public/uploads.
    this.uploadsRoot = process.env.LOCAL_UPLOADS_ROOT || path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(this.uploadsRoot)) {
      fs.mkdirSync(this.uploadsRoot, { recursive: true });
    }
  }

  public async upload(options: UploadOptions): Promise<UploadResult> {
    const { file, mimeType, category, entityId = 'general', maxSizeBytes } = options;

    // Check size limit
    if (maxSizeBytes && file.length > maxSizeBytes) {
      throw new Error(`Image is too large. Maximum allowed size is ${Math.round(maxSizeBytes / (1024 * 1024))} MB.`);
    }

    // Validate magic bytes
    const validation = validateImageMagicBytes(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid image file.');
    }

    const actualMime = validation.detectedMime || mimeType;

    // Determine extension
    let ext = 'jpg';
    if (actualMime === 'image/png') ext = 'png';
    else if (actualMime === 'image/webp') ext = 'webp';
    else if (actualMime === 'image/avif') ext = 'avif';

    // Generate collision-resistant unique identifier
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const safeFilename = `${uniqueId}.${ext}`;

    // Target directory: public/uploads/{category}/{entityId}
    const safeEntityId = entityId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetDir = path.join(this.uploadsRoot, category, safeEntityId);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, safeFilename);

    // Write file securely
    await fs.promises.writeFile(targetPath, file);

    const publicUrl = `/uploads/${category}/${safeEntityId}/${safeFilename}`;

    return {
      url: publicUrl,
      filename: safeFilename,
      size: file.length,
      mimeType: actualMime,
      provider: 'local',
    };
  }

  public async delete(publicUrl: string): Promise<boolean> {
    try {
      if (!publicUrl || !publicUrl.startsWith('/uploads/')) {
        return false; // Not a local storage asset
      }

      const relative = publicUrl.replace(/^\/uploads\//, '');
      const fullPath = path.join(this.uploadsRoot, relative);

      // Path traversal check: must stay within uploadsRoot
      const normalizedPath = path.normalize(fullPath);
      if (!normalizedPath.startsWith(this.uploadsRoot)) {
        console.warn('Attempted path traversal during image deletion:', publicUrl);
        return false;
      }

      if (fs.existsSync(normalizedPath)) {
        await fs.promises.unlink(normalizedPath);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting stored image:', err);
      return false;
    }
  }

  public getPublicUrl(relativePath: string): string {
    if (relativePath.startsWith('/')) return relativePath;
    return `/${relativePath}`;
  }
}
