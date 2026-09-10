import React from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  borderRadius,
  className = '',
}) => {
  return (
    <div
      className={`${styles.skeleton} ${className}`}
      style={{
        width: width !== undefined ? width : undefined,
        height: height !== undefined ? height : undefined,
        borderRadius: borderRadius !== undefined ? borderRadius : undefined,
      }}
      aria-hidden="true"
    />
  );
};

export const AnimeCardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`${styles.cardSkeleton} ${className}`}>
      <div className={styles.posterSkeleton} />
      <div className={styles.titleSkeleton} />
      <div className={styles.metaSkeleton} />
    </div>
  );
};

export const ContinueWatchingSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`${styles.continueSkeleton} ${className}`}>
      <div className={styles.continuePosterSkeleton} />
      <div className={styles.continueContentSkeleton}>
        <div className={styles.continueHeaderSkeleton} />
        <div className={styles.continueTitleSkeleton} />
        <div className={styles.continueBarSkeleton} />
      </div>
    </div>
  );
};
