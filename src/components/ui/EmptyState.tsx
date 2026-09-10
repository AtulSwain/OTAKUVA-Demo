import React from 'react';
import Link from 'next/link';
import { LucideIcon, Inbox } from 'lucide-react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = '',
}) => {
  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.iconWrapper}>
        <Icon size={24} strokeWidth={1.5} className={styles.icon} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      
      {actionLabel && (
        <div className={styles.actionWrapper}>
          {actionHref ? (
            <Link href={actionHref} className={styles.actionBtn}>
              {actionLabel}
            </Link>
          ) : onAction ? (
            <button type="button" onClick={onAction} className={styles.actionBtn}>
              {actionLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
};
