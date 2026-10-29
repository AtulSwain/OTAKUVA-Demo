'use client';

import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, isThemeId, type ThemeId } from '../../lib/theme/themes';
import styles from './ThemePicker.module.css';

const EVENT = 'otakuva:theme';

function currentTheme(): ThemeId {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const attr = document.documentElement.getAttribute('data-theme');
  return isThemeId(attr) ? attr : DEFAULT_THEME;
}

export function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  if (id === DEFAULT_THEME) root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', id);
  try {
    if (id === DEFAULT_THEME) localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* private mode: the theme still applies for this visit */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  const page = THEMES.find((t) => t.id === id)?.page;
  if (meta && page) meta.setAttribute('content', page);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

/** Swatch row: pick the site's colour theme (saved on this device). */
export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    setTheme(currentTheme());
    const sync = () => setTheme(currentTheme());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  return (
    <div className={`${styles.picker} ${compact ? styles.compact : ''}`} role="radiogroup" aria-label="Site theme">
      {THEMES.map((t) => {
        const on = t.id === theme;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            className={`${styles.option} ${on ? styles.on : ''}`}
            onClick={() => applyTheme(t.id)}
            title={t.label}
          >
            <span className={styles.swatch} style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 0 50%, ${t.swatch[1]} 50% 100%)` }} aria-hidden="true">
              {on && <Check size={compact ? 12 : 14} strokeWidth={3} />}
            </span>
            <span className={styles.label}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
