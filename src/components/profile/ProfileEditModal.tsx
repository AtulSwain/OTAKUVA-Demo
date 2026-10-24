'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { X, Upload, Camera, Trash2, Loader2 } from 'lucide-react';
import { resolveAvatarUrl, resolveMediaUrl } from '../../lib/mediaResolver';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import styles from './ProfileEditModal.module.css';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProfile: {
    displayName: string;
    username: string;
    bio: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    isLibraryPublic?: boolean;
    isActivityPublic?: boolean;
  };
  onSave: (updated: {
    displayName: string;
    bio: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    isLibraryPublic: boolean;
    isActivityPublic: boolean;
  }) => void;
}

export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  isOpen,
  onClose,
  initialProfile,
  onSave,
}) => {
  const { showToast } = useToast();
  const { refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(initialProfile.displayName || '');
  const [bio, setBio] = useState(initialProfile.bio || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(resolveAvatarUrl(initialProfile.avatarUrl));
  const [bannerPreview, setBannerPreview] = useState<string | null>(initialProfile.bannerUrl || null);
  const [isLibraryPublic, setIsLibraryPublic] = useState(initialProfile.isLibraryPublic ?? true);
  const [isActivityPublic, setIsActivityPublic] = useState(initialProfile.isActivityPublic ?? true);
  // Persisted server-side (User.showJoinedCommunities); null until the current value has loaded.
  const [showJoinedCommunities, setShowJoinedCommunities] = useState<boolean | null>(null);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch(`/api/users/${encodeURIComponent(initialProfile.username)}/badges`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && typeof d?.showJoinedCommunities === 'boolean') setShowJoinedCommunities(d.showJoinedCommunities);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, initialProfile.username]);

  if (!isOpen) return null;

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 10 * 1024 * 1024) {
      showToast('Avatar image must be under 10MB', 'error');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      showToast('Supported formats: JPG, PNG, WEBP, GIF', 'error');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload avatar');
      }

      setAvatarPreview(data.avatarUrl);
      showToast('Avatar updated successfully', 'success');
      await refreshUser();
    } catch (err: any) {
      showToast(err.message || 'Avatar upload failed', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true);
    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove avatar');
      }

      setAvatarPreview(null);
      showToast('Avatar removed', 'info');
      await refreshUser();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove avatar', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 15 * 1024 * 1024) {
      showToast('Banner image must be under 15MB', 'error');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      showToast('Supported formats: JPG, PNG, WEBP, GIF', 'error');
      return;
    }

    setIsUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/profile/banner', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload banner');
      }

      setBannerPreview(data.bannerUrl);
      showToast('Banner updated successfully', 'success');
      await refreshUser();
    } catch (err: any) {
      showToast(err.message || 'Banner upload failed', 'error');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleRemoveBanner = async () => {
    setIsUploadingBanner(true);
    try {
      const res = await fetch('/api/profile/banner', {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove banner');
      }

      setBannerPreview(null);
      showToast('Banner removed', 'info');
      await refreshUser();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove banner', 'error');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Blank (or the bare username) clears it, so the @handle shows alone.
          displayName: displayName.trim() && displayName.trim() !== initialProfile.username ? displayName.trim() : '',
          bio: bio.trim(),
          ...(showJoinedCommunities !== null ? { showJoinedCommunities } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save profile changes');
      }

      const updated = {
        displayName: data.user?.displayName || displayName.trim() || initialProfile.username,
        bio: bio.trim(),
        avatarUrl: avatarPreview,
        bannerUrl: bannerPreview,
        isLibraryPublic,
        isActivityPublic,
      };

      onSave(updated);
      showToast('Profile saved successfully', 'success');
      await refreshUser();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Edit Profile</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Banner Upload */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Profile Banner</label>
            <div className={styles.bannerPreview}>
              {bannerPreview ? (
                <Image src={resolveMediaUrl(bannerPreview) || bannerPreview} alt="Banner Preview" fill className={styles.previewImg} unoptimized />
              ) : (
                <span>No custom banner set</span>
              )}
            </div>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className={styles.hiddenFileInput}
              onChange={handleBannerFile}
              disabled={isUploadingBanner}
            />
            <div className={styles.buttonGroup}>
              <button
                type="button"
                className={styles.uploadBtn}
                onClick={() => bannerInputRef.current?.click()}
                disabled={isUploadingBanner}
              >
                {isUploadingBanner ? (
                  <Loader2 size={14} className={styles.spinner} />
                ) : (
                  <Upload size={14} />
                )}
                <span>{isUploadingBanner ? 'Uploading...' : bannerPreview ? 'Change Banner' : 'Upload Banner'}</span>
              </button>

              {bannerPreview && (
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={handleRemoveBanner}
                  disabled={isUploadingBanner}
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </div>

          {/* Avatar Upload */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Avatar</label>
            <div className={styles.uploadRow}>
              <div className={styles.avatarPreview}>
                {avatarPreview ? (
                  <Image src={resolveMediaUrl(avatarPreview) || avatarPreview} alt="Avatar Preview" fill className={styles.previewImg} unoptimized />
                ) : (
                  <span>{initialProfile.username.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className={styles.hiddenFileInput}
                onChange={handleAvatarFile}
                disabled={isUploadingAvatar}
              />
              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  className={styles.uploadBtn}
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  {isUploadingAvatar ? (
                    <Loader2 size={14} className={styles.spinner} />
                  ) : (
                    <Camera size={14} />
                  )}
                  <span>{isUploadingAvatar ? 'Uploading...' : 'Change Avatar'}</span>
                </button>

                {avatarPreview && (
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={handleRemoveAvatar}
                    disabled={isUploadingAvatar}
                  >
                    <Trash2 size={14} />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Display Name</label>
            <input
              type="text"
              className={styles.input}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your public name..."
              maxLength={40}
            />
          </div>

          {/* Bio */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Bio</label>
            <textarea
              className={styles.textarea}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell other anime archivists about your favorite genres and taste..."
              maxLength={500}
            />
          </div>

          {/* Privacy Controls */}
          <div className={styles.privacySection}>
            <label className={styles.label}>Privacy Settings</label>

            <div className={styles.privacyRow}>
              <span className={styles.privacyLabel}>Public Library</span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={isLibraryPublic}
                  onChange={(e) => setIsLibraryPublic(e.target.checked)}
                />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.privacyRow}>
              <span className={styles.privacyLabel}>Public Activity Timeline</span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={isActivityPublic}
                  onChange={(e) => setIsActivityPublic(e.target.checked)}
                />
                <span className={styles.slider} />
              </label>
            </div>

            <div className={styles.privacyRow}>
              <span className={styles.privacyLabel}>Show communities I have joined</span>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={showJoinedCommunities ?? true}
                  disabled={showJoinedCommunities === null}
                  onChange={(e) => setShowJoinedCommunities(e.target.checked)}
                  aria-label="Show communities I have joined on my profile"
                />
                <span className={styles.slider} />
              </label>
            </div>
          </div>

          {/* Footer Controls */}
          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className={styles.saveBtn} disabled={isSaving || isUploadingAvatar || isUploadingBanner}>
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
