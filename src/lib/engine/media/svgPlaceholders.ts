/**
 * OTAKUVA SVG Entity Placeholders
 * High-performance, zero-external-dependency, deterministic inline SVGs
 * for fallback states across all entity types.
 */

export type EntityType = 'ANIME' | 'CHARACTER' | 'STUDIO' | 'CREATOR' | 'NEWS' | 'COMMUNITY' | 'EPISODE';

export function getEntitySvgPlaceholder(type: EntityType = 'ANIME', label?: string): string {
  const safeLabel = (label || type).slice(0, 20).replace(/[<>&"]/g, '');
  
  let iconPath = '';
  let badgeColor = '#6366f1';
  let bgColor = '#0f1422';
  let strokeColor = '#3b82f6';

  switch (type) {
    case 'ANIME':
      badgeColor = '#6366f1'; // Indigo
      strokeColor = '#818cf8';
      // Film / Play icon
      iconPath = '<path d="M10 8l10 6-10 6V8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';
      break;
    case 'CHARACTER':
      badgeColor = '#ec4899'; // Pink
      strokeColor = '#f472b6';
      // User / Avatar icon
      iconPath = '<circle cx="15" cy="11" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 25c0-4.4 4.5-8 10-8s10 3.6 10 8" fill="none" stroke="currentColor" stroke-width="2"/>';
      break;
    case 'STUDIO':
      badgeColor = '#10b981'; // Emerald
      strokeColor = '#34d399';
      // Building / Studio icon
      iconPath = '<rect x="6" y="8" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 12h2v2h-2zM18 12h2v2h-2zM10 18h2v2h-2zM18 18h2v2h-2z" fill="currentColor"/>';
      break;
    case 'CREATOR':
      badgeColor = '#A1A1AA'; // Violet
      strokeColor = '#a78bfa';
      // Pen / Quill icon
      iconPath = '<path d="M18 4l8 8-16 16H2v-8L18 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';
      break;
    case 'NEWS':
      badgeColor = '#f59e0b'; // Amber
      strokeColor = '#fbbf24';
      // Newspaper icon
      iconPath = '<rect x="4" y="6" width="22" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10h14M8 14h14M8 18h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
      break;
    case 'COMMUNITY':
      badgeColor = '#3b82f6'; // Blue
      strokeColor = '#60a5fa';
      // Message / Group icon
      iconPath = '<path d="M6 8a4 4 0 014-4h10a4 4 0 014 4v8a4 4 0 01-4 4h-4l-4 4v-4H10a4 4 0 01-4-4V8z" fill="none" stroke="currentColor" stroke-width="2"/>';
      break;
    case 'EPISODE':
    default:
      badgeColor = '#64748b';
      strokeColor = '#94a3b8';
      iconPath = '<polygon points="9 6 21 15 9 24 9 6" fill="none" stroke="currentColor" stroke-width="2"/>';
      break;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450" fill="none">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a0e17"/>
        <stop offset="50%" stop-color="${bgColor}"/>
        <stop offset="100%" stop-color="#05070c"/>
      </linearGradient>
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${badgeColor}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.05"/>
      </linearGradient>
    </defs>
    <rect width="300" height="450" fill="url(#bg)"/>
    <circle cx="150" cy="190" r="70" fill="url(#accent)"/>
    <g transform="translate(135, 175) scale(1)" color="${strokeColor}">
      ${iconPath}
    </g>
    <text x="150" y="290" text-anchor="middle" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" letter-spacing="1">
      ${type}
    </text>
    <text x="150" y="315" text-anchor="middle" fill="#64748b" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="400">
      ${safeLabel}
    </text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
