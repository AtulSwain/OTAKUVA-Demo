/**
 * Draws the shareable profile card onto a canvas (client-only). The same
 * canvas is the on-screen preview and the PNG that gets downloaded/shared,
 * so what people see is exactly what they send.
 *
 * Every number on the card is the member's real data passed in by the
 * caller; anything missing is left off, never filled with a placeholder.
 */
import { TIERS, getTier, progressToNext, tierIndex, type Tier, type TierKey } from '../badges/tiers';
import { GLYPHS } from '../badges/glyphPaths';
import { glossFor } from '../badges/strings';
import { SEAL_BEADS, SEAL_CENTER, SEAL_GLYPHS, SEAL_ORNAMENTS, SEAL_RADII, SEAL_STUDS } from '../badges/sealOrnaments';

export const CARD_W = 1080;
export const CARD_H = 1350;

export interface ProfileCardData {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  tier: TierKey;
  /** Level points (counted reviews + rated anime) — drives the level/progress. */
  countedReviews: number;
  /** Shown as separate stats when known (2026-10-27). */
  reviewCount?: number;
  ratedCount?: number;
  /** Creator account: blue tick chip after the level chip (2026-10-27). */
  isCreator?: boolean;
  /** Optional stats; each is shown only when provided. */
  stats: { label: string; value: string }[];
  profileUrl: string;
}

/** Colours for drawing on the card's dark background (dark-theme overrides applied). */
function sealColors(t: Tier) {
  const fill = t.dark?.fill ?? t.fill;
  const ink = t.dark?.ink ?? t.ink ?? '#9a9aa5';
  const stroke = t.dark?.stroke ?? t.stroke;
  const accent = t.special ? (t.stroke ?? t.fill ?? '#ffffff') : (t.dark?.stroke ?? t.dark?.fill ?? t.fill ?? '#9a9aa5');
  return { fill, ink, stroke, outline: t.dark?.outline ?? null, accent };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The round hanko seal, matching components/badges/Seal.tsx (68-unit viewBox). */
function drawSeal(ctx: CanvasRenderingContext2D, t: Tier, x: number, y: number, size: number) {
  const c = sealColors(t);
  const k = size / 68;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  const glyph = (ch: string, cx: number, cy: number, scale: number) => {
    const g = GLYPHS[ch];
    if (!g) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-(g.x1 + g.x2) / 2, -(g.y1 + g.y2) / 2);
    ctx.fill(new Path2D(g.d));
    ctx.restore();
  };
  const chars = Array.from(t.kanji);
  const kanji = (dx = 0, dy = 0) =>
    chars.length === 1
      ? glyph(chars[0], SEAL_CENTER + dx, SEAL_CENTER + dy, SEAL_GLYPHS.singleScale)
      : chars.forEach((ch, i) => glyph(ch, SEAL_CENTER + dx, SEAL_GLYPHS.pairCenters[i] + dy, SEAL_GLYPHS.pairScale));
  const circle = (r: number) => {
    ctx.beginPath();
    ctx.arc(SEAL_CENTER, SEAL_CENTER, r, 0, Math.PI * 2);
  };
  if (c.fill === null) {
    ctx.fillStyle = 'rgba(200,200,210,0.06)';
    circle(SEAL_RADII.outline);
    ctx.fill();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(200,200,210,0.75)';
    ctx.lineWidth = 1.4;
    circle(SEAL_RADII.outline);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(200,200,210,0.35)';
    ctx.lineWidth = 0.9;
    circle(SEAL_RADII.ringInner);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,200,210,0.75)';
    kanji();
  } else {
    // Same build as components/badges/Seal.tsx at full detail (round hanko).
    const rank = tierIndex(t);
    const line = t.special && c.stroke ? c.stroke : c.ink;
    ctx.fillStyle = c.fill;
    circle(SEAL_RADII.plate);
    ctx.fill();
    const depth = ctx.createLinearGradient(0, 0, 68, 68);
    depth.addColorStop(0, 'rgba(255,255,255,0.26)');
    depth.addColorStop(0.45, 'rgba(255,255,255,0)');
    depth.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = depth;
    circle(SEAL_RADII.plate);
    ctx.fill();
    if (c.outline) {
      ctx.strokeStyle = c.outline;
      ctx.lineWidth = 1.4;
      circle(SEAL_RADII.outline);
      ctx.stroke();
    }
    if (t.special && c.stroke) {
      ctx.strokeStyle = c.stroke;
      ctx.lineWidth = 1.6;
      circle(SEAL_RADII.outline);
      ctx.stroke();
    }
    const bevel = ctx.createLinearGradient(0, 0, 0, 68);
    bevel.addColorStop(0, 'rgba(255,255,255,0.45)');
    bevel.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    bevel.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.strokeStyle = bevel;
    ctx.lineWidth = 1.2;
    circle(SEAL_RADII.bevel);
    ctx.stroke();
    ctx.strokeStyle = line;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 0.7;
    circle(SEAL_RADII.ringOuter);
    ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1.3;
    circle(SEAL_RADII.ringInner);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = line;
    if (rank >= SEAL_ORNAMENTS.BEADS_FROM) ctx.fill(new Path2D(SEAL_BEADS));
    if (rank >= SEAL_ORNAMENTS.STUDS_FROM) ctx.fill(new Path2D(SEAL_STUDS));
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    kanji(0.6, 0.9);
    ctx.fillStyle = c.ink;
    kanji();
  }
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const done = (ok: boolean) => resolve(ok ? img : null);
    img.onload = () => done(true);
    img.onerror = () => done(false);
    setTimeout(() => done(img.complete && img.naturalWidth > 0), 6000);
    img.src = src;
  });
}

/** Fills the box like CSS `object-fit: cover`, clipped to it (a tall image must never spill below). */
function coverDraw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, focusY = 0.35) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * s;
  const ih = img.naturalHeight * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) * focusY, iw, ih);
  ctx.restore();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight: number, family: string, min = 28) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return;
    s -= 2;
  } while (s > min);
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

export type CardTheme = 'banner' | 'manga' | 'minimal';

export const CARD_THEMES: { key: CardTheme; label: string }[] = [
  { key: 'banner', label: 'Banner' },
  { key: 'manga', label: 'Manga' },
  { key: 'minimal', label: 'Minimal' },
];

export interface RenderOptions {
  /** Draw the banner/avatar photos. Off when a cross-origin image would block exporting. */
  images?: boolean;
  /** Background style. 'banner' falls back to 'manga' when there's no banner. */
  theme?: CardTheme;
}

/** '#RRGGBB' + alpha -> rgba(). */
function rgba(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const BG = '#08080c';
const PAD = 80;

export async function renderProfileCard(canvas: HTMLCanvasElement, data: ProfileCardData, opts: RenderOptions = {}) {
  const images = opts.images !== false;
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const family = (typeof document !== 'undefined' && getComputedStyle(document.body).fontFamily) || 'system-ui, sans-serif';
  if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready.catch(() => undefined);

  const tier = getTier(data.tier);
  const colors = sealColors(tier);
  // The starter level has no colour of its own; use the site accent so a beginner's card isn't grey.
  const accent = colors.fill === null ? '#7C7C86' : colors.accent;
  const progress = progressToNext(data.countedReviews);
  const level = tierIndex(tier) + 1;

  const [banner, avatar, logo] = await Promise.all([
    images && data.bannerUrl ? loadImage(data.bannerUrl) : null,
    images && data.avatarUrl ? loadImage(data.avatarUrl) : null,
    loadImage('/brand/otakuva-mark@2x.png'),
  ]);

  // ── Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const ART_H = 640;
  const theme: CardTheme = opts.theme === 'banner' && !banner ? 'manga' : (opts.theme ?? (banner ? 'banner' : 'manga'));

  if (theme === 'banner' && banner) {
    coverDraw(ctx, banner, 0, 0, CARD_W, ART_H);
    // Tame bright art evenly, then fade to solid well before the art ends.
    ctx.fillStyle = 'rgba(8,8,12,0.28)';
    ctx.fillRect(0, 0, CARD_W, ART_H);
    const top = ctx.createLinearGradient(0, 0, 0, 220);
    top.addColorStop(0, 'rgba(8,8,12,0.75)');
    top.addColorStop(1, 'rgba(8,8,12,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, CARD_W, 220);
    const fade = ctx.createLinearGradient(0, ART_H * 0.35, 0, ART_H);
    fade.addColorStop(0, 'rgba(8,8,12,0)');
    fade.addColorStop(0.6, 'rgba(8,8,12,0.8)');
    fade.addColorStop(1, BG);
    ctx.fillStyle = fade;
    ctx.fillRect(0, ART_H * 0.35, CARD_W, ART_H * 0.65 + 1);
  } else if (theme === 'manga') {
    drawMangaArt(ctx, banner, accent, family);
  } else {
    drawMinimalArt(ctx, tier, accent, family);
  }

  // A soft glow of the tier colour along the bottom.
  const floor = ctx.createRadialGradient(CARD_W * 0.15, CARD_H, 10, CARD_W * 0.15, CARD_H, 700);
  floor.addColorStop(0, rgba(accent, 0.18));
  floor.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ── Top bar: logo + level chip
  ctx.textBaseline = 'middle';
  let lx = PAD;
  if (logo) {
    const h = 56;
    const w = (logo.naturalWidth / logo.naturalHeight) * h;
    ctx.drawImage(logo, lx, 96 - h / 2, w, h);
    lx += w + 16;
  }
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.font = `800 38px ${family}`;
  ctx.letterSpacing = '6px';
  ctx.fillText('OTAKUVA', lx, 98);
  ctx.letterSpacing = '3px';
  const chip = `LV ${level} · ${data.isCreator ? 'CREATOR' : 'REVIEWER'}`;
  ctx.font = `800 22px ${family}`;
  const cw = ctx.measureText(chip).width + 44;
  ctx.fillStyle = 'rgba(8,8,12,0.55)';
  roundRect(ctx, CARD_W - PAD - cw, 72, cw, 50, 25);
  ctx.fill();
  ctx.strokeStyle = rgba(accent === '#ffffff' ? '#ffffff' : accent, 0.9);
  ctx.lineWidth = 2;
  roundRect(ctx, CARD_W - PAD - cw, 72, cw, 50, 25);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(chip, CARD_W - PAD - cw / 2, 98);
  ctx.letterSpacing = '0px';

  // ── Avatar with a glowing tier ring
  const ar = 128;
  const ax = PAD + ar + 6;
  const ay = 560;
  ctx.save();
  ctx.shadowColor = rgba(accent, 0.7);
  ctx.shadowBlur = 60;
  const ring = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
  ring.addColorStop(0, '#ffffff');
  ring.addColorStop(0.5, accent);
  ring.addColorStop(1, rgba(accent, 0.6));
  ctx.beginPath();
  ctx.arc(ax, ay, ar + 12, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(ax, ay, ar + 4, 0, Math.PI * 2);
  ctx.fillStyle = BG;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) coverDraw(ctx, avatar, ax - ar, ay - ar, ar * 2, ar * 2);
  else {
    const fill = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
    fill.addColorStop(0, rgba(accent, 0.8));
    fill.addColorStop(1, '#1a1a24');
    ctx.fillStyle = fill;
    ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 120px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((data.displayName || data.username).slice(0, 1).toUpperCase(), ax, ay + 6);
  }
  ctx.restore();

  // ── The hanko, stamped big and slightly crooked
  const seal = 200;
  ctx.save();
  ctx.translate(CARD_W - PAD - seal / 2 - 10, 560);
  ctx.rotate((-8 * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  if (colors.fill === null) {
    // Unfilled starter seal: give it a plate so it reads on any banner.
    ctx.fillStyle = 'rgba(8,8,12,0.6)';
    ctx.beginPath();
    ctx.arc(0, 0, seal / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowColor = 'transparent';
  drawSeal(ctx, tier, -seal / 2, -seal / 2, seal);
  ctx.restore();

  // ── Name, handle, title
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  fitText(ctx, data.displayName, CARD_W - PAD * 2, 92, 900, family, 44);
  ctx.fillText(ellipsize(ctx, data.displayName, CARD_W - PAD * 2), PAD, 820);
  ctx.font = `500 34px ${family}`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(ellipsize(ctx, `@${data.username}`, CARD_W - PAD * 2), PAD, 872);

  const gloss = glossFor(tier.glossKey);
  ctx.font = `800 30px ${family}`;
  ctx.letterSpacing = '2px';
  const title = `${tier.name.toUpperCase()}`;
  const tw = ctx.measureText(title).width;
  ctx.letterSpacing = '0px';
  ctx.font = `600 30px ${family}`;
  const sub = ` · ${gloss}`;
  const sw = ctx.measureText(sub).width;
  const pillW = tw + sw + 60;
  const pill = ctx.createLinearGradient(PAD, 0, PAD + pillW, 0);
  pill.addColorStop(0, rgba(accent, 0.5));
  pill.addColorStop(1, rgba(accent, 0.12));
  ctx.fillStyle = pill;
  roundRect(ctx, PAD, 906, pillW, 62, 31);
  ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 30px ${family}`;
  ctx.letterSpacing = '2px';
  ctx.fillText(title, PAD + 30, 938);
  ctx.letterSpacing = '0px';
  ctx.font = `600 30px ${family}`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(sub, PAD + 30 + tw + 4, 938);

  // Creator: the same blue tick as on creator reviews, right after the level chip.
  if (data.isCreator) {
    const cx0 = PAD + pillW + 16;
    ctx.font = `800 28px ${family}`;
    ctx.letterSpacing = '1px';
    const label = 'Creator';
    const lw0 = ctx.measureText(label).width;
    const cwid = 62 + lw0 + 26;
    ctx.fillStyle = 'rgba(79,156,249,0.16)';
    roundRect(ctx, cx0, 906, cwid, 62, 31);
    ctx.fill();
    ctx.strokeStyle = 'rgba(79,156,249,0.55)';
    ctx.lineWidth = 2;
    roundRect(ctx, cx0, 906, cwid, 62, 31);
    ctx.stroke();
    drawVerifiedTick(ctx, cx0 + 36, 937, 19);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(label, cx0 + 62, 938);
    ctx.letterSpacing = '0px';
  }

  // ── Stats, big numbers between thin dividers
  const stats = [
    { label: 'Reviews', value: (data.reviewCount ?? data.countedReviews).toLocaleString('en-US') },
    ...(data.ratedCount != null ? [{ label: 'Rated', value: data.ratedCount.toLocaleString('en-US') }] : []),
    ...data.stats,
  ].slice(0, 4);
  const top = 996;
  const colW = (CARD_W - PAD * 2) / stats.length;
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, top);
  ctx.lineTo(CARD_W - PAD, top);
  ctx.stroke();
  stats.forEach((st, i) => {
    const x = PAD + i * colW;
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(x, top + 30);
      ctx.lineTo(x, top + 112);
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    const pad = i === 0 ? 0 : 30;
    fitText(ctx, st.value, colW - pad - 16, 66, 900, family, 32);
    ctx.fillText(st.value, x + pad, top + 86);
    ctx.font = `700 21px ${family}`;
    ctx.letterSpacing = '3px';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(st.label.toUpperCase(), x + pad, top + 120);
    ctx.letterSpacing = '0px';
  });

  // ── Level track: one segment per step between the nine levels
  const ty = 1220;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `800 28px ${family}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`Level ${level}`, PAD, ty - 22);
  const lw = ctx.measureText(`Level ${level}`).width;
  ctx.font = `600 28px ${family}`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(` / ${TIERS.length}`, PAD + lw, ty - 22);
  ctx.textAlign = 'right';
  ctx.font = `600 26px ${family}`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(
    progress.next ? `${progress.remaining.toLocaleString('en-US')} more to ${progress.next.name}` : 'Every level unlocked',
    CARD_W - PAD,
    ty - 22
  );
  const segs = TIERS.length - 1;
  const gap = 8;
  const segW = (CARD_W - PAD * 2 - gap * (segs - 1)) / segs;
  const cur = tierIndex(tier);
  for (let i = 0; i < segs; i++) {
    const x = PAD + i * (segW + gap);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    roundRect(ctx, x, ty, segW, 14, 7);
    ctx.fill();
    const segTier = TIERS[i + 1];
    const part = i < cur ? 1 : i === cur ? (progress.next ? progress.fraction : 1) : 0;
    if (part > 0) {
      ctx.fillStyle = sealColors(segTier).accent;
      roundRect(ctx, x, ty, Math.max(14, segW * part), 14, 7);
      ctx.fill();
    }
  }

  // ── Footer
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `600 26px ${family}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  let shown = data.profileUrl.replace(/^https?:\/\//, '');
  try {
    shown = decodeURIComponent(shown);
  } catch {
    /* keep the encoded form */
  }
  ctx.fillText(ellipsize(ctx, shown, CARD_W - PAD * 2 - 330), PAD, 1294);
  ctx.textAlign = 'right';
  ctx.font = `600 22px ${family}`;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.letterSpacing = '2px';
  ctx.fillText('TRACK · RATE · DISCOVER', CARD_W - PAD, 1292);
  ctx.letterSpacing = '0px';
}

// ───────────────────────── Theme art (2026-10-27) ─────────────────────────

/** Where the seal is stamped (same point as in renderProfileCard). */
const SEAL_X = CARD_W - PAD - 110;
const SEAL_Y = 560;
const PAPER = '#ECE8DE';
const INK = '#0B0B0E';
const STARTER_ACCENT = '#7C7C86';

/** The blue scalloped tick used for creators (lucide BadgeCheck look). */
function drawVerifiedTick(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.beginPath();
  const lobes = 8;
  for (let i = 0; i <= lobes * 2; i++) {
    const a = (i / (lobes * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.84 : r;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#4F9CF9';
  ctx.strokeStyle = '#4F9CF9';
  ctx.lineJoin = 'round';
  ctx.lineWidth = r * 0.22;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.42, cy + r * 0.02);
  ctx.lineTo(cx - r * 0.1, cy + r * 0.32);
  ctx.lineTo(cx + r * 0.44, cy - r * 0.3);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = r * 0.24;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Screentone: a dot grid whose dot radius follows `size(u, v)` (u, v in 0..1 across the box). */
function screentone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  step: number,
  size: (u: number, v: number) => number,
  color: string
) {
  ctx.fillStyle = color;
  for (let j = 0, yy = y; yy < y + h + step; yy += step, j++) {
    for (let xx = x + (j % 2 ? step / 2 : 0); xx < x + w + step; xx += step) {
      const r = size((xx - x) / w, (yy - y) / h);
      if (r <= 0.15) continue;
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Manga focus lines (集中線): thin ink wedges aimed at (cx, cy), leaving the middle clear. */
function focusLines(ctx: CanvasRenderingContext2D, cx: number, cy: number, inner: number, outer: number, count: number, color: string) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + ((i * 37) % 11) * 0.004;
    const len = inner + ((i * 53) % 7) * 18;
    const w = 0.004 + ((i * 29) % 5) * 0.0022;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    ctx.lineTo(cx + Math.cos(a - w) * outer, cy + Math.sin(a - w) * outer);
    ctx.lineTo(cx + Math.cos(a + w) * outer, cy + Math.sin(a + w) * outer);
    ctx.closePath();
    ctx.fill();
  }
}

/** A photo turned to ink: greyscale + contrast, a paper tint, then a fine halftone. */
function inkedPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, focusY: number) {
  const canFilter = typeof (ctx as unknown as { filter?: unknown }).filter === 'string';
  ctx.save();
  if (canFilter) ctx.filter = 'grayscale(1) contrast(1.6) brightness(1.1)';
  coverDraw(ctx, img, x, y, w, h, focusY);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (!canFilter) {
    // No canvas filters (older Safari): drop the colour with a blend instead.
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(x, y, w, h);
  }
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = PAPER;
  ctx.fillRect(x, y, w, h);
  screentone(ctx, x, y, w, h, 6, () => 1.1, 'rgba(0,0,0,0.2)');
  ctx.restore();
}

/** Bold sound-effect lettering: white keyline, ink outline, spot-colour fill. */
function sfx(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, angle: number, fill: string, family: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.font = `900 ${size}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size * 0.22;
  ctx.strokeText(text, 0, 0);
  ctx.strokeStyle = INK;
  ctx.lineWidth = size * 0.1;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * Manga page (owner, 2026-10-27): an ink title band, then paper with
 * black-bordered panels. With a banner, the banner is inked (greyscale,
 * contrast, halftone) into the panels; without one they get screentone,
 * speed lines and a sound effect. Focus lines burst from behind the seal;
 * the tier colour is the page's one spot colour.
 */
function drawMangaArt(ctx: CanvasRenderingContext2D, banner: HTMLImageElement | null, accent: string, family: string) {
  const BAND = 150;
  const BOTTOM = 732;
  const M = 30; // page margin
  const G = 14; // gutter
  const MID = 452; // bottom of the top row
  const spot = accent === STARTER_ACCENT ? '#ffffff' : accent;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, CARD_W, BAND);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, BAND, CARD_W, BOTTOM - BAND);

  const top = BAND + 18;
  const A: [number, number][] = [[M, top], [646, top], [600, MID], [M, MID]];
  const B: [number, number][] = [[646 + G, top], [CARD_W - M, top], [CARD_W - M, MID], [600 + G, MID]];
  const C: [number, number][] = [[M, MID + G], [CARD_W - M, MID + G], [CARD_W - M, BOTTOM - 14], [M, BOTTOM - 14]];

  // Panel A
  ctx.save();
  poly(ctx, A);
  ctx.clip();
  if (banner) inkedPhoto(ctx, banner, M, top, 646 - M, MID - top, 0.3);
  else {
    screentone(ctx, M, top, 646 - M, MID - top, 9, (u, v) => 0.5 + 3.4 * Math.max(0, 1 - (u * 0.75 + (1 - v) * 0.55)), 'rgba(11,11,14,0.85)');
    ctx.strokeStyle = 'rgba(11,11,14,0.8)';
    for (let i = 0; i < 24; i++) {
      const yy = top + 20 + i * 12 + ((i * 7) % 5);
      ctx.lineWidth = 1 + ((i * 3) % 3);
      ctx.beginPath();
      ctx.moveTo(M + 160 + ((i * 41) % 160), yy + 30);
      ctx.lineTo(660, yy - 30);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Panel B
  ctx.save();
  poly(ctx, B);
  ctx.clip();
  if (banner) inkedPhoto(ctx, banner, 600 + G, top, CARD_W - M - (600 + G), MID - top, 0.15);
  else {
    screentone(ctx, 600 + G, top, CARD_W - M - 600 - G, MID - top, 8, (u, v) => 0.6 + 2.4 * v, 'rgba(11,11,14,0.6)');
    focusLines(ctx, 860, top + 140, 60, 600, 70, 'rgba(11,11,14,0.55)');
  }
  ctx.restore();
  sfx(ctx, 'ドン！', 860, top + 130, banner ? 92 : 124, -0.16, spot, family);

  // Panel C: screentone floor + focus lines on the seal (the avatar and seal pop out over it).
  ctx.save();
  poly(ctx, C);
  ctx.clip();
  if (banner) {
    inkedPhoto(ctx, banner, M, MID + G, CARD_W - 2 * M, BOTTOM - 14 - MID - G, 0.75);
    ctx.fillStyle = 'rgba(236,232,222,0.6)';
    ctx.fillRect(M, MID + G, CARD_W - 2 * M, BOTTOM - MID);
  }
  screentone(ctx, M, MID + G, CARD_W - 2 * M, BOTTOM - MID, 10, (u) => 0.3 + 2.4 * (1 - u), 'rgba(11,11,14,0.32)');
  focusLines(ctx, SEAL_X, SEAL_Y, 150, 1300, 130, 'rgba(11,11,14,0.85)');
  ctx.restore();

  // Ink panel borders
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.lineJoin = 'miter';
  for (const p of [A, B, C]) {
    poly(ctx, p);
    ctx.stroke();
  }
  // Paper edge into the dark lower half
  const fade = ctx.createLinearGradient(0, BOTTOM - 10, 0, BOTTOM + 30);
  fade.addColorStop(0, 'rgba(8,8,12,0)');
  fade.addColorStop(1, BG);
  ctx.fillStyle = fade;
  ctx.fillRect(0, BOTTOM - 10, CARD_W, 40);
}

/**
 * Minimal (owner, 2026-10-27: "not a blank background"): a soft wash of the
 * tier colour, fine pinstripes, ink ripples around the seal and the level's
 * kanji as a large outlined watermark.
 */
function drawMinimalArt(ctx: CanvasRenderingContext2D, tier: Tier, accent: string, family: string) {
  const tint = accent === STARTER_ACCENT ? '#B9B9C4' : accent;
  const wash = ctx.createLinearGradient(0, 0, CARD_W, CARD_H * 0.75);
  wash.addColorStop(0, rgba(tint, 0.26));
  wash.addColorStop(0.5, rgba(tint, 0.05));
  wash.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 2;
  for (let x = -CARD_H; x < CARD_W; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + CARD_H, CARD_H);
    ctx.stroke();
  }
  ctx.restore();

  // Kanji watermark, outlined, top right above the seal.
  ctx.save();
  ctx.font = `900 220px ${family}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 3;
  ctx.strokeStyle = rgba(tint, 0.24);
  ctx.strokeText(tier.kanjiFull, CARD_W - PAD + 10, 380);
  ctx.restore();

  // Ripples around the seal.
  [150, 196, 250, 314, 390].forEach((r, i) => {
    ctx.beginPath();
    ctx.arc(SEAL_X, SEAL_Y, r, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(tint, Math.max(0.05, 0.32 - i * 0.065));
    ctx.lineWidth = i === 0 ? 3 : 2;
    ctx.stroke();
  });

  // Top hairline in the tier colour.
  const line = ctx.createLinearGradient(0, 0, CARD_W, 0);
  line.addColorStop(0, rgba(tint, 0));
  line.addColorStop(0.5, rgba(tint, 0.95));
  line.addColorStop(1, rgba(tint, 0));
  ctx.fillStyle = line;
  ctx.fillRect(0, 0, CARD_W, 6);
}

/**
 * PNG of the card. If a photo's host doesn't allow cross-origin use the
 * canvas can't be exported, so it's redrawn without photos rather than failing.
 */
export async function profileCardBlob(canvas: HTMLCanvasElement, data: ProfileCardData, theme?: CardTheme): Promise<Blob | null> {
  const toBlob = () =>
    new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b), 'image/png');
      } catch {
        resolve(null);
      }
    });
  let blob = await toBlob();
  if (!blob) {
    await renderProfileCard(canvas, data, { images: false, theme });
    blob = await toBlob();
  }
  return blob;
}
