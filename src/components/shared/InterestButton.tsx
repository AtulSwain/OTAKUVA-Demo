import React from 'react';
import { Flame } from 'lucide-react';
import styles from './InterestButton.module.css';

export interface InterestButtonProps {
  count: number;
  active: boolean;
  onToggle: () => void;
}

export const InterestButton: React.FC<InterestButtonProps> = ({ count, active, onToggle }) => (
  <button type="button" className={`${styles.button} ${active ? styles.active : ''}`} aria-pressed={active} onClick={onToggle}>
    <Flame size={16} fill={active ? 'currentColor' : 'none'} aria-hidden="true" />
    <span>{count} interested</span>
  </button>
);
