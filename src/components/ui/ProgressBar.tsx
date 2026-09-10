import React from 'react';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  value: number; // 0 to 100
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  size = 'md',
  className = '',
  ariaLabel = 'Progress',
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      className={`${styles.track} ${styles[size]} ${className}`}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div
        className={styles.fill}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
};
