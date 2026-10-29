/**
 * Site colour themes (2026-10-26, owner). Graphite is the default and the
 * look the site had before; the others retint the page and the accent only.
 * Saved per device in localStorage — no account setting, no server call.
 * CSS lives in src/styles/themes.css; keep the ids in step with it.
 */
export const THEME_STORAGE_KEY = 'otakuva-theme';

export const THEMES = [
  { id: 'graphite', label: 'Graphite', swatch: ['#141416', '#E4E4E7'], page: '#141416' },
  { id: 'midnight', label: 'Midnight', swatch: ['#0E1220', '#8FAFFF'], page: '#0E1220' },
  { id: 'sakura', label: 'Sakura', swatch: ['#17121A', '#F58AB8'], page: '#17121A' },
  { id: 'ember', label: 'Ember', swatch: ['#17120F', '#FF8A4C'], page: '#17120F' },
  { id: 'emerald', label: 'Emerald', swatch: ['#0F1513', '#5FD4A4'], page: '#0F1513' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export const DEFAULT_THEME: ThemeId = 'graphite';

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && THEMES.some((t) => t.id === v);
}

/**
 * Runs inline in <head> before paint so a saved theme never flashes the
 * default. Only applies an id from the fixed list.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(${JSON.stringify(
  THEMES.map((t) => t.id).filter((id) => id !== 'graphite')
)}.indexOf(t)>-1)document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
