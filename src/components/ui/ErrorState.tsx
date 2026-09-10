import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import styles from './ErrorState.module.css';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading content. Please try again.',
  onRetry,
  className = '',
}) => {
  return (
    <div className={`${styles.container} ${className}`} role="alert">
      <div className={styles.iconWrapper}>
        <AlertCircle size={24} strokeWidth={1.5} className={styles.icon} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
      
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={styles.retryBtn}
        >
          <RotateCcw size={16} strokeWidth={1.75} />
          <span>Try again</span>
        </button>
      )}
    </div>
  );
};
