import { StorageProvider } from './types';
import { LocalStorageProvider } from './localStorageProvider';
import { R2StorageProvider } from './r2StorageProvider';

let storageInstance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!storageInstance) {
    const providerType = process.env.STORAGE_PROVIDER || 'local';

    if (providerType === 'r2') {
      const r2 = new R2StorageProvider();
      if (r2.isConfigured()) {
        storageInstance = r2;
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
