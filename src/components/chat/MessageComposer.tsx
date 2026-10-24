'use client';

import React, { useRef, useState } from 'react';
import { Send, ImagePlus, Sticker, Loader2, X } from 'lucide-react';
import { GifPicker, PickedGif } from '../community/comments/GifPicker';
import styles from './MessageComposer.module.css';

export interface OutgoingMessage {
  content?: string;
  messageType?: 'TEXT' | 'IMAGE' | 'GIF';
  mediaUrl?: string;
  gifId?: string;
}

interface MessageComposerProps {
  onSend: (message: OutgoingMessage) => Promise<void> | void;
  onTypingChange?: (isTyping: boolean) => void;
  placeholder?: string;
  uploadUrl?: string;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSend,
  onTypingChange,
  placeholder = 'Message...',
  uploadUrl = '/api/uploads/chat-media',
}) => {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    resizeTextarea();

    if (onTypingChange) {
      onTypingChange(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => onTypingChange(false), 2000);
    }
  };

  const stopTyping = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onTypingChange?.(false);
  };

  const handleSendText = async () => {
    const content = text.trim();
    if (!content || isSending) return;
    setIsSending(true);
    stopTyping();
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    try {
      await onSend({ content, messageType: 'TEXT' });
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handlePickGif = async (gif: PickedGif) => {
    setShowGifPicker(false);
    setIsSending(true);
    try {
      await onSend({ messageType: 'GIF', gifId: gif.id });
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(uploadUrl, { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Upload failed');
        return;
      }
      await onSend({ messageType: 'IMAGE', mediaUrl: data.media.url });
    } catch {
      setError('Upload failed. Check your connection.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={styles.composer}>
      {error && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-label)', margin: '0 0 6px 4px' }}>
          {error}
        </p>
      )}

      {showGifPicker && (
        <div className={styles.pickerAnchor}>
          <GifPicker onPick={handlePickGif} onClose={() => setShowGifPicker(false)} />
        </div>
      )}

      <div className={styles.inputRow}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder={placeholder}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onBlur={stopTyping}
          rows={1}
          disabled={isSending}
        />

        <div className={styles.toolIcons}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setShowGifPicker((v) => !v)}
            aria-label={showGifPicker ? 'Close GIF search' : 'Search GIFs'}
            title="GIF"
          >
            {showGifPicker ? <X size={16} /> : <Sticker size={16} />}
          </button>

          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach an image"
            title="Attach image"
            disabled={isUploading}
          >
            {isUploading ? <Loader2 size={16} className={styles.spin} /> : <ImagePlus size={16} />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <button
            type="button"
            className={styles.sendBtn}
            onClick={handleSendText}
            disabled={!text.trim() || isSending}
            aria-label="Send message"
          >
            {isSending ? <Loader2 size={14} className={styles.spin} /> : <Send size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
};
