/**
 * The round hanko stamp's geometry and ornaments, by position on the ladder
 * (never by tier name, so tiers.ts can change without touching the
 * drawings). Shared by the SVG seal (components/badges/Seal.tsx) and the
 * share card's canvas copy (lib/share/profileCard.ts) so the two always match.
 * Round since 2026-10-23 (owner: "like a Japanese stamp, in a circle").
 *
 *   every earned tier  — enamel disc, bevel, embossed kanji, double ring
 *   BEADS_FROM         — a ring of beads between the rim and the outer ring
 *   STUDS_FROM         — four diamond studs on the outer ring (N/E/S/W)
 *   special tiers      — gilt lines + shimmer (the `special` flag in tiers.ts)
 */
export const SEAL_ORNAMENTS = {
  BEADS_FROM: 3,
  STUDS_FROM: 5,
  /** Below this many px the fine detail turns to mush; draw the simple seal. */
  DETAIL_MIN_PX: 40,
  /** Rough, hand-stamped edge only where it can be seen. */
  TEXTURE_MIN_PX: 60,
} as const;

/** All in the seal's 68-unit coordinates, centred on (34, 34). */
export const SEAL_CENTER = 34;
export const SEAL_RADII = {
  plate: 34,
  outline: 33.3,
  bevel: 32.4,
  /** Simple single ring at small sizes. */
  border: 29.5,
  ringOuter: 30.2,
  ringInner: 27.4,
  beads: 32,
} as const;

/** SVG/Path2D path for a full circle. */
export function circlePath(r: number, cx = SEAL_CENTER, cy = SEAL_CENTER) {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
}

/** 24 small beads around the rim, skipping the four stud positions. */
export const SEAL_BEADS = Array.from({ length: 24 }, (_, i) => i)
  .filter((i) => i % 6 !== 0)
  .map((i) => {
    const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const x = SEAL_CENTER + Math.cos(a) * SEAL_RADII.beads;
    const y = SEAL_CENTER + Math.sin(a) * SEAL_RADII.beads;
    return circlePath(0.75, +x.toFixed(2), +y.toFixed(2));
  })
  .join('');

/** Diamond studs on the outer ring at north, south, west and east. */
export const SEAL_STUDS = [
  [SEAL_CENTER, SEAL_CENTER - SEAL_RADII.ringOuter],
  [SEAL_CENTER, SEAL_CENTER + SEAL_RADII.ringOuter],
  [SEAL_CENTER - SEAL_RADII.ringOuter, SEAL_CENTER],
  [SEAL_CENTER + SEAL_RADII.ringOuter, SEAL_CENTER],
]
  .map(([x, y]) => `M${x} ${y - 2.6}L${x + 2.6} ${y}L${x} ${y + 2.6}L${x - 2.6} ${y}Z`)
  .join('');

/** Glyph placement inside the inner ring: a two-character stack, or one centred character. */
export const SEAL_GLYPHS = {
  pairScale: 0.022,
  singleScale: 0.04,
  pairCenters: [22.5, 45.5],
} as const;
