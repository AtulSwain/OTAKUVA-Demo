export interface UploadOptions {
  file: Buffer;
  filename: string;
  mimeType: string;
  category:
    | 'community-icon'
    | 'community-banner'
    | 'profile-avatar'
    | 'profile-banner'
    | 'avatars'
    | 'general'
    | 'studio-logo'
    | 'studio-banner';
  entityId?: string;
  maxSizeBytes?: number;
  customKey?: string;
}

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  provider: 'local' | 's3' | 'cloudinary' | 'r2';
  storageKey?: string;
}

export interface StorageProvider {
  name: string;
  upload(options: UploadOptions): Promise<UploadResult>;
  delete(publicUrlOrKey: string): Promise<boolean>;
  getPublicUrl(relativePathOrKey: string): string;
}
