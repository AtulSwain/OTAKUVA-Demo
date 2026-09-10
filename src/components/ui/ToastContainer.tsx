'use client';

import React from 'react';
import { CheckCircle2, Heart, Info, AlertCircle, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import styles from './ToastContainer.module.css';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className={styles.container} aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => {
        let Icon = CheckCircle2;
        let iconClass = styles.iconSuccess;

        if (toast.type === 'favorite') {
          Icon = Heart;
          iconClass = styles.iconFavorite;
        } else if (toast.type === 'info') {
          Icon = Info;
          iconClass = styles.iconInfo;
        } else if (toast.type === 'error') {
          Icon = AlertCircle;
          iconClass = styles.iconError;
        }

        return (
          <div key={toast.id} className={styles.toast} role="status">
            <div className={styles.content}>
              <span className={`${styles.iconWrap} ${iconClass}`}>
                <Icon size={16} fill={toast.type === 'favorite' ? 'currentColor' : 'none'} />
              </span>
              <span className={styles.message}>{toast.message}</span>
            </div>

            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
