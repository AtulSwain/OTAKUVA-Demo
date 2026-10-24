import { StorageProvider, UploadOptions, UploadResult } from './types';
import { LocalStorageProvider } from './localStorageProvider';
import { R2AuthError, R2StorageProvider } from './r2StorageProvider';

let storageInstance: StorageProvider | null = null;

/**
 * Development only: R2 first, but if R2 rejects the credentials (revoked or
 * rolled token) switch this process to local storage instead of failing
 * every profile/banner/community upload. Production never uses this — a
 * bad token there must fail loudly, not quietly write to ephemeral disk.
 */
export class DevR2WithLocalFallback implements StorageProvider {
  public name = 'r2';
  private local: LocalStorageProvider | null = null;

  constructor(private readonly r2: Pick<R2StorageProvider, 'upload' | 'delete' | 'getPublicUrl'>) {}

  private fallback(): LocalStorageProvider {
    if (!this.local) {
      this.local = new LocalStorageProvider();
      this.name = 'local';
    }
    return this.local;
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    if (this.local) return this.local.upload(options);
    try {
      return await this.r2.upload(options);
    } catch (err) {
      if (!(err instanceof R2AuthError)) throw err;
      console.warn(`[Storage] ${err.message} Falling back to local storage (public/uploads) for this dev server.`);
      return this.fallback().upload(options);
    }
  }

  async delete(publicUrlOrKey: string): Promise<boolean> {
    // Local files are served from /uploads/…; everything else lives in R2.
    if (publicUrlOrKey?.startsWith('/uploads/')) return this.fallback().delete(publicUrlOrKey);
    return this.r2.delete(publicUrlOrKey);
  }

  getPublicUrl(relativePathOrKey: string): string {
    return this.local ? this.local.getPublicUrl(relativePathOrKey) : this.r2.getPublicUrl(relativePathOrKey);
  }
}

export function getStorageProvider(): StorageProvider {
  if (!storageInstance) {
    const providerType = process.env.STORAGE_PROVIDER || 'local';

    if (providerType === 'r2') {
      const r2 = new R2StorageProvider();
      if (r2.isConfigured()) {
        storageInstance = process.env.NODE_ENV === 'production' ? r2 : new DevR2WithLocalFallback(r2);
      } else {
        console.warn(
          '[Storage] STORAGE_PROVIDER is set to "r2", but R2 credentials are not configured. Falling back to LocalStorageProvider for development.'
        );
        storageInstance = new LocalStorageProvider();
      }
    } else {
      storageInstance = new LocalStorageProvider();
    }
  }

  return storageInstance;
}

export * from './types';
export * from './imageValidator';
export * from './imageProcessor';
export * from './r2StorageProvider';
export * from './localStorageProvider';
