import React, { useState } from 'react';
import styles from './VibeScore.module.css';

export interface VibeScoreProps {
  score: number | string;
  expandable?: boolean;
  defaultOpen?: boolean;
  breakdown?: Array<{ label: string; value: number }>;
}

export const VibeScore: React.FC<VibeScoreProps> = ({ score, expandable = false, defaultOpen = false, breakdown = [] }) => {
  const [expanded, setExpanded] = useState(defaultOpen);
  const content = <><strong className={styles.score}>{score}</strong><span className={styles.label}>OTAKUVA VIBE</span></>;

  if (!expandable) return <div className={styles.collapsed}>{content}</div>;

  return (
    <div className={`${styles.wrapper} ${expanded ? styles.wrapperExpanded : ''}`}>
      <button type="button" className={styles.trigger} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{content}</button>
      <div className={styles.breakdownPanel}>
        <span className={styles.breakdownTitle}>Vibe Breakdown</span>
        <div className={styles.breakdown} aria-label="Otakuva Vibe breakdown">
          {breakdown.map(({ label, value }) => <div className={styles.breakdownTile} key={label}><strong>{value.toFixed(1)}</strong><span>{label}</span></div>)}
        </div>
      </div>
    </div>
  );
};
