'use client';

import React, { useEffect, useState } from 'react';
import styles from './TypedName.module.css';

/**
 * The member's name typing itself out after "Welcome back," on the homepage
 * (2026-10-20): letter by letter with a blinking caret, then one soft
 * shimmer and the caret fades. Shows the full name at once for reduced
 * motion, and the full name is always in the accessible label.
 */
export function TypedName({ text }: { text: string }) {
  const [shown, setShown] = useState(text.length);
  const [done, setDone] = useState(true);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !text) {
      setShown(text.length);
      setDone(true);
      return;
    }
    setShown(0);
    setDone(false);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    // A short pause so "Welcome back," lands first, then ~55ms per letter.
    const step = () => {
      i += 1;
      setShown(i);
      if (i < text.length) timer = setTimeout(step, 55 + Math.random() * 35);
      else timer = setTimeout(() => setDone(true), 900);
    };
    timer = setTimeout(step, 450);
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <span className={`${styles.wrap} ${done ? styles.done : ''}`} aria-label={text}>
      <span className={styles.text} aria-hidden="true">
        {text.slice(0, shown)}
      </span>
      <span className={styles.caret} aria-hidden="true" />
    </span>
  );
}
