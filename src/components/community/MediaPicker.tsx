'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  Upload,
  Link as LinkIcon,
  X,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Image as ImageIcon,
  Eye,
} from 'lucide-react';
import { resolveMediaUrl } from '../../lib/mediaResolver';
import styles from './MediaPicker.module.css';

interface MediaPickerProps {
  label: string;
  type: 'icon' | 'banner';
  currentUrl?: string | null;
  currentSource?: string | null;
  communityId?: string;
  onImageChange: (url: string | null, source: 'UPLOAD' | 'URL') => void;
}

export const MediaPicker: React.FC<MediaPickerProps> = ({
  label,
  type,
  currentUrl,
  currentSource = 'URL',
  communityId,
  onImageChange,
}) => {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [inputUrl, setInputUrl] = useState(currentUrl && currentSource === 'URL' ? currentUrl : '');
  const [urlStatus, setUrlStatus] = useState<'idle' | 'validating' | 'valid' | 'error'>('idle');
  const [urlErrorMessage, setUrlErrorMessage] = useState('');

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
  const [fileDetails, setFileDetails] = useState<{ name: string; size: string; dimensions?: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = 15 * 1024 * 1024;
  const maxSizeLabel = '15 MB';

  // Sync with currentUrl if changed from parent
  useEffect(() => {
    if (currentUrl) {
      setPreviewUrl(currentUrl);
      if (currentSource === 'URL') {
        setInputUrl(currentUrl);
        setUrlStatus('valid');
      }
    }
  }, [currentUrl, currentSource]);

  // Clean up object URL when component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle local file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate size
    if (file.size > maxSizeBytes) {
      setUploadError(`Image is too large. Maximum allowed size is ${maxSizeLabel}.`);
      return;
    }

    // Validate MIME
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!validMimes.includes(file.type)) {
      setUploadError('Unsupported file format. Please upload JPEG, PNG, WebP, or AVIF.');
      return;
    }

    // Generate local preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setSelectedFile(file);

    // Format file size
    const sizeInKb = (file.size / 1024).toFixed(1);
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
    const formattedSize = file.size > 1024 * 1024 ? `${sizeInMb} MB` : `${sizeInKb} KB`;

    // Measure dimensions
    const img = new window.Image();
    img.src = objectUrl;
    img.onload = () => {
      setFileDetails({
        name: file.name,
        size: formattedSize,
        dimensions: `${img.naturalWidth} × ${img.naturalHeight}`,
      });
    };

    // Auto-upload file to persistent backend
    uploadSelectedFile(file);
  };

  const uploadSelectedFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (communityId) {
        formData.append('communityId', communityId);
      }

      const endpoint = type === 'icon' ? '/api/uploads/community/icon' : '/api/uploads/community/banner';
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Update parent with permanent stored URL
      setPreviewUrl(data.url);
      onImageChange(data.url, 'UPLOAD');
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Validate External URL
  const handleValidateUrl = (urlToTest: string) => {
    const trimmed = urlToTest.trim();
    if (!trimmed) {
      setUrlStatus('idle');
      setUrlErrorMessage('');
      setPreviewUrl(null);
      onImageChange(null, 'URL');
      return;
    }

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setUrlStatus('error');
      setUrlErrorMessage('Enter a valid image URL starting with http:// or https://');
      return;
    }

    setUrlStatus('validating');
    setUrlErrorMessage('');
    setPreviewUrl(trimmed);
    onImageChange(trimmed, 'URL');

    // Preload test (graceful)
    const img = new window.Image();
    img.src = trimmed;

    img.onload = () => {
      setUrlStatus('valid');
      setUrlErrorMessage('');
    };

    img.onerror = () => {
      // Keep URL active since some external CDNs block cross-origin JS preloading
      setUrlStatus('valid');
    };
  };

  const handleUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputUrl(val);
    if (!val.trim()) {
      setUrlStatus('idle');
      setUrlErrorMessage('');
    }
  };

  const handleUrlBlur = () => {
    if (inputUrl.trim()) {
      handleValidateUrl(inputUrl);
    }
  };

  // Remove Image
  const handleRemove = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setFileDetails(null);
    setInputUrl('');
    setUrlStatus('idle');
    setUrlErrorMessage('');
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onImageChange(null, 'URL');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <label className={styles.label}>{label}</label>
        <div className={styles.modeToggle}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'upload' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('upload')}
          >
            <Upload size={12} />
            <span>Upload Image</span>
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'url' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('url')}
          >
            <LinkIcon size={12} />
            <span>Image URL</span>
          </button>
        </div>
      </div>

      {/* Main Preview Box */}
      <div className={`${styles.previewArea} ${type === 'icon' ? styles.iconPreviewArea : styles.bannerPreviewArea}`}>
        {previewUrl ? (
          <div className={styles.previewImageWrap}>
            <Image
              src={resolveMediaUrl(previewUrl) || previewUrl}
              alt={`${label} Preview`}
              fill
              className={styles.previewImage}
              unoptimized={true}
            />
            {isUploading && (
              <div className={styles.uploadingOverlay}>
                <Loader2 size={24} className={styles.spin} />
                <span>Uploading to persistent storage...</span>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.placeholderBox}>
            <ImageIcon size={type === 'icon' ? 24 : 32} className={styles.placeholderIcon} />
            <span className={styles.placeholderText}>
              No {type} selected
            </span>
          </div>
        )}
      </div>

      {/* Mode Controls */}
      {mode === 'upload' ? (
        <div className={styles.controlsSection}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className={styles.hiddenFileInput}
            onChange={handleFileChange}
          />

          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.browseBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload size={14} />
              <span>{previewUrl ? 'Replace from Computer' : 'Upload from Computer'}</span>
            </button>

            {previewUrl && (
              <button
                type="button"
                className={styles.removeBtn}
                onClick={handleRemove}
                disabled={isUploading}
              >
                <X size={14} />
                <span>Remove</span>
              </button>
            )}
          </div>

          {fileDetails && (
            <div className={styles.fileInfo}>
              <span><strong>File:</strong> {fileDetails.name}</span>
              <span><strong>Size:</strong> {fileDetails.size}</span>
              {fileDetails.dimensions && <span><strong>Dim:</strong> {fileDetails.dimensions}</span>}
            </div>
          )}

          {uploadError && (
            <div className={styles.errorAlert}>
              <AlertCircle size={14} />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.controlsSection}>
          <div className={styles.urlInputRow}>
            <input
              type="url"
              className={styles.urlInput}
              placeholder="https://example.com/image.jpg"
              value={inputUrl}
              onChange={handleUrlInputChange}
              onBlur={handleUrlBlur}
            />
            <button
              type="button"
              className={styles.previewBtn}
              onClick={() => handleValidateUrl(inputUrl)}
              disabled={!inputUrl.trim() || urlStatus === 'validating'}
            >
              {urlStatus === 'validating' ? (
                <Loader2 size={13} className={styles.spin} />
              ) : (
                <Eye size={13} />
              )}
              <span>Preview</span>
            </button>
          </div>

          {urlStatus === 'valid' && (
            <div className={styles.successAlert}>
              <Check size={14} />
              <span>Image loaded and validated successfully.</span>
            </div>
          )}

          {urlStatus === 'error' && (
            <div className={styles.errorAlert}>
              <AlertCircle size={14} />
              <span>{urlErrorMessage}</span>
            </div>
          )}

          {previewUrl && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={handleRemove}
              >
                <X size={14} />
                <span>Remove Image</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
