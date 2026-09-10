import React from 'react';
import { UserWatchStatus, AiringStatus } from '../../types/anime';
import styles from './StatusBadge.module.css';

type StatusType = UserWatchStatus | AiringStatus | 'airing' | 'finished' | 'upcoming';

interface StatusBadgeProps {
  status: StatusType;
  isActive?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  watching: 'Watching',
  completed: 'Completed',
  plan_to_watch: 'Plan to Watch',
  on_hold: 'On Hold',
  dropped: 'Dropped',
  Airing: 'Airing',
  Finished: 'Finished',
  Upcoming: 'Upcoming',
  airing: 'Airing',
  finished: 'Finished',
  upcoming: 'Upcoming',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  isActive = false,
  size = 'md',
  className = '',
}) => {
  const normalizedKey = status.toLowerCase();
  const label = STATUS_LABELS[status] || status;

  return (
    <span
      className={`
        ${styles.badge} 
        ${styles[normalizedKey] || styles.neutral} 
        ${isActive ? styles.active : ''} 
        ${styles[size]} 
        ${className}
      `}
    >
      {label}
    </span>
  );
};
