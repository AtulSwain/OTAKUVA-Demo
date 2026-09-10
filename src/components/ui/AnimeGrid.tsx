import React from 'react';
import styles from './AnimeGrid.module.css';

interface AnimeGridProps {
  children: React.ReactNode;
  columns?: 'auto' | 2 | 3 | 4 | 5 | 6;
  className?: string;
}

export const AnimeGrid: React.FC<AnimeGridProps> = ({
  children,
  columns = 'auto',
  className = '',
}) => {
  return (
    <div
      className={`
        ${styles.grid}
        ${columns !== 'auto' ? styles[`cols-${columns}`] : styles.colsAuto}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
