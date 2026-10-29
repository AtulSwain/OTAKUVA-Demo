import React from 'react';
import styles from './SeasonScene.module.css';

/**
 * Seasonal artwork for the homepage masthead (owner, 2026-10-27: "a fall
 * season theme image … more premium"). Drawn in SVG — no stock or anime art —
 * one palette per season: spring sakura, summer fireflies, fall maple,
 * winter snow. A torii on a hill under a low sun/moon, trees at the edge,
 * gently falling particles (off under prefers-reduced-motion). Decorative.
 */
type Season = 'Winter' | 'Spring' | 'Summer' | 'Fall';

interface Palette {
  sky: [string, string, string];
  glow: string;
  disc: string;
  far: string;
  mid: string;
  near: string;
  tree: [string, string];
  particle: string[];
  kanji: string;
  caps?: string; // snow on the peaks
}

const PALETTES: Record<Season, Palette> = {
  Spring: {
    sky: ['#17121c', '#4a2a44', '#c97a96'],
    glow: '#ffc4d6',
    disc: '#ffe1ea',
    far: '#4a2c45',
    mid: '#2c1a2b',
    near: '#160d16',
    tree: ['#e88aaa', '#f6b6cb'],
    particle: ['#ffd0de', '#f7a8c2', '#ffffff'],
    kanji: '春',
  },
  Summer: {
    sky: ['#081018', '#12324a', '#2f7a8a'],
    glow: '#a8f0e0',
    disc: '#eafff8',
    far: '#143546',
    mid: '#0c2230',
    near: '#06121a',
    tree: ['#123a2c', '#1d5a40'],
    particle: ['#f8f3a0', '#d8ff9a', '#fff6c8'],
    kanji: '夏',
  },
  Fall: {
    sky: ['#120c0e', '#3d1a14', '#b8532a'],
    glow: '#ffb070',
    disc: '#ffd39a',
    far: '#4a2218',
    mid: '#2a130e',
    near: '#140a08',
    tree: ['#8e2a14', '#c8461e'],
    particle: ['#e8662e', '#c8401f', '#f2a443'],
    kanji: '秋',
  },
  Winter: {
    sky: ['#0a0e16', '#1c2740', '#5a7096'],
    glow: '#cfe0ff',
    disc: '#f2f6ff',
    far: '#2a3550',
    mid: '#18203a',
    near: '#0c1120',
    tree: ['#22304a', '#3a4c6c'],
    particle: ['#ffffff', '#e6eeff', '#cfdcf5'],
    kanji: '冬',
    caps: '#dfe8f7',
  },
};

/**
 * Owner-supplied artwork per season (2026-10-27). A season listed here shows
 * the picture instead of the drawn scene; falling particles stay on top.
 */
const ARTWORK: Partial<Record<Season, { src: string; small: string; position: string }>> = {
  Fall: { src: '/brand/seasons/fall.webp', small: '/brand/seasons/fall-sm.webp', position: '50% 22%' },
};

// Fixed particle layout (no randomness → same markup on server and client).
const PARTICLES = [
  { x: 8, d: 0, t: 11, s: 1 }, { x: 18, d: 3.5, t: 13, s: 0.8 }, { x: 27, d: 7, t: 10, s: 1.1 },
  { x: 36, d: 1.5, t: 12, s: 0.7 }, { x: 45, d: 5, t: 14, s: 0.9 }, { x: 54, d: 9, t: 11, s: 1 },
  { x: 62, d: 2.5, t: 13, s: 1.2 }, { x: 70, d: 6.5, t: 10, s: 0.8 }, { x: 78, d: 4, t: 12, s: 1 },
  { x: 86, d: 8, t: 11, s: 0.9 }, { x: 93, d: 1, t: 14, s: 1.1 }, { x: 74, d: 10.5, t: 12, s: 0.7 },
];

const MAPLE = 'M0,-9 L2,-4 L7,-6 L5,-1 L9,1 L4,3 L5,8 L0,5 L-5,8 L-4,3 L-9,1 L-5,-1 L-7,-6 L-2,-4 Z';

function Particle({ season, color, scale }: { season: Season; color: string; scale: number }) {
  if (season === 'Fall') return <path d={MAPLE} fill={color} transform={`scale(${scale})`} />;
  if (season === 'Spring') return <ellipse rx={5 * scale} ry={3 * scale} fill={color} opacity={0.9} />;
  if (season === 'Summer') return <circle r={2.6 * scale} fill={color} className={styles.firefly} />;
  return <circle r={2.4 * scale} fill={color} opacity={0.9} />;
}

/** Leaf / blossom / snow clumps along the hanging branch. */
const CLUMPS = [
  { x: 612, y: 206, r: -20, s: 1.2 }, { x: 636, y: 196, r: 25, s: 1.5 }, { x: 652, y: 216, r: -45, s: 1.1 },
  { x: 676, y: 186, r: 10, s: 1.6 }, { x: 664, y: 226, r: 60, s: 1.2 }, { x: 706, y: 180, r: -15, s: 1.4 },
  { x: 728, y: 204, r: 35, s: 1.3 }, { x: 742, y: 222, r: -30, s: 1.1 }, { x: 756, y: 174, r: 20, s: 1.5 },
  { x: 786, y: 170, r: -10, s: 1.3 }, { x: 692, y: 200, r: 80, s: 1 }, { x: 626, y: 222, r: 40, s: 0.9 },
];

function Clump({ season, p, x, y, r, s, i }: { season: Season; p: Palette; x: number; y: number; r: number; s: number; i: number }) {
  const fill = p.tree[i % 2];
  const t = `translate(${x} ${y}) rotate(${r}) scale(${s})`;
  if (season === 'Fall') return <path d={MAPLE} fill={fill} transform={t} />;
  if (season === 'Spring')
    return (
      <g transform={t}>
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx={0} cy={-4.2} rx={3.2} ry={4.4} fill={fill} transform={`rotate(${a})`} />
        ))}
        <circle r={1.6} fill="#fff4f7" />
      </g>
    );
  if (season === 'Summer') return <ellipse rx={8} ry={3.6} fill={fill} transform={t} />;
  return <ellipse rx={9} ry={4} fill={p.caps} opacity={0.9} transform={`translate(${x} ${y - 4}) scale(${s})`} />;
}

/** A branch reaching in from the top-right corner, in the season's dress. */
function Branch({ season, p }: { season: Season; p: Palette }) {
  return (
    <g>
      <path d="M830,150 Q720,168 640,196 Q620,204 604,214" stroke={p.near} strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d="M706,176 Q690,198 664,224" stroke={p.near} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <path d="M752,166 Q752,192 740,220" stroke={p.near} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M660,190 Q640,210 624,222" stroke={p.near} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {CLUMPS.map((c, i) => (
        <Clump key={i} season={season} p={p} {...c} i={i} />
      ))}
    </g>
  );
}

export function SeasonScene({ season }: { season: string }) {
  const key = (['Winter', 'Spring', 'Summer', 'Fall'] as Season[]).find((s) => s.toLowerCase() === season.toLowerCase()) ?? 'Fall';
  const p = PALETTES[key];
  const id = `scene-${key.toLowerCase()}`;
  const rising = key === 'Summer'; // fireflies drift up; everything else falls

  return (
    <div className={styles.scene} aria-hidden="true" data-scene="">
      {ARTWORK[key] ? (
        <>
          <picture>
            <source media="(max-width: 760px)" srcSet={ARTWORK[key]!.small} />
            <img
              src={ARTWORK[key]!.src}
              alt=""
              className={styles.art}
              style={{ objectPosition: ARTWORK[key]!.position }}
              decoding="async"
              fetchPriority="high"
            />
          </picture>
          <span className={styles.artShade} />
        </>
      ) : (
        <svg viewBox="0 0 800 400" preserveAspectRatio="xMaxYMax slice" className={styles.svg}>
          <defs>
            <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.sky[0]} />
              <stop offset="55%" stopColor={p.sky[1]} />
              <stop offset="100%" stopColor={p.sky[2]} />
            </linearGradient>
            <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor={p.glow} stopOpacity={0.55} />
              <stop offset="100%" stopColor={p.glow} stopOpacity={0} />
            </radialGradient>
            <linearGradient id={`${id}-mist`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.sky[2]} stopOpacity={0} />
              <stop offset="100%" stopColor={p.sky[2]} stopOpacity={0.35} />
            </linearGradient>
          </defs>

          <rect width="800" height="400" fill={`url(#${id}-sky)`} />
          {/* Stars, faint */}
          {[[120, 178], [260, 196], [410, 172], [470, 222], [330, 236], [180, 230], [560, 182]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.4 : 1} fill="#fff" opacity={key === 'Fall' || key === 'Spring' ? 0.35 : 0.6} />
          ))}

          {/* Low sun / moon with a wide glow */}
          <circle cx="540" cy="268" r="150" fill={`url(#${id}-glow)`} />
          <circle cx="540" cy="268" r="44" fill={p.disc} opacity={0.92} />

          {/* Kanji for the season, very faint */}
          <text x="440" y="300" textAnchor="middle" className={styles.kanji}>{p.kanji}</text>

          {/* Far range */}
          <path d="M0,322 L90,284 L170,306 L260,266 L350,302 L430,276 L520,306 L610,270 L700,298 L800,276 L800,400 L0,400 Z" fill={p.far} opacity={0.9} />
          {p.caps && (
            <path d="M246,274 L260,266 L276,276 L266,274 L258,279 Z M596,278 L610,270 L626,280 L614,278 L606,283 Z M78,291 L90,284 L104,292 L92,290 Z" fill={p.caps} opacity={0.85} />
          )}
          <rect y="262" width="800" height="138" fill={`url(#${id}-mist)`} />
          {/* Mid range */}
          <path d="M0,348 L120,316 L230,340 L330,310 L450,340 L560,322 L680,344 L800,322 L800,400 L0,400 Z" fill={p.mid} />

          {/* Near hill with the torii */}
          <path d="M280,400 Q420,336 560,350 Q700,362 800,350 L800,400 Z" fill={p.near} />
          <g transform="translate(410 352) scale(0.62)" fill={p.near}>
            <path d="M-62,-78 Q0,-90 62,-78 L66,-70 Q0,-80 -66,-70 Z" />
            <rect x="-52" y="-66" width="104" height="7" />
            <rect x="-40" y="-72" width="7" height="72" />
            <rect x="33" y="-72" width="7" height="72" />
            <rect x="-3" y="-66" width="6" height="8" />
          </g>

          {/* Ground in front */}
          <path d="M0,400 L0,386 Q200,374 420,388 Q620,398 800,380 L800,400 Z" fill={p.near} />

          {/* Branch from the top-right corner */}
          <Branch season={key} p={p} />
        </svg>
      )}

      {/* Falling (or, in summer, drifting) particles */}
      <div className={`${styles.particles} ${rising ? styles.rise : ''}`}>
        {PARTICLES.map((q, i) => (
          <span
            key={i}
            className={styles.particle}
            style={{ left: `${q.x}%`, animationDelay: `${-q.d}s`, animationDuration: `${q.t}s` }}
          >
            <svg viewBox="-10 -10 20 20" width="20" height="20">
              <Particle season={key} color={p.particle[i % p.particle.length]} scale={q.s} />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}
