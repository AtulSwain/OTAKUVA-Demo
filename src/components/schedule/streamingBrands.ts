/**
 * Display colours for streaming platform chips. Purely presentational —
 * which platforms a show is on comes from the API (StreamingAvailability);
 * an unknown platform just gets the neutral colour.
 */
const BRAND_COLORS: Record<string, string> = {
  crunchyroll: '#F47521',
  netflix: '#E50914',
  'amazon prime video': '#1FA8F4',
  'prime video': '#1FA8F4',
  hulu: '#1CE783',
  hidive: '#00AEEF',
  'disney plus': '#2C6BFF',
  'disney+': '#2C6BFF',
  youtube: '#FF0033',
  'bilibili tv': '#00A1D6',
  bilibili: '#00A1D6',
  iq: '#00CC4C',
  iqiyi: '#00CC4C',
  'tubi tv': '#FA382F',
  max: '#5822F5',
  'adult swim': '#D9D9D9',
  retrocrush: '#FFCC00',
  'tencent video': '#FF7A00',
  wetv: '#FF7A00',
  'apple tv+': '#D9D9D9',
};

export function streamingBrandColor(name: string): string {
  return BRAND_COLORS[name.trim().toLowerCase()] ?? '#A1A1AA';
}
