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
  countedReviews: number;
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
    // Manga speed lines bursting from behind the seal, in the tier colour.
    // Same point the seal is stamped at below.
    const cx = CARD_W - PAD - 110;
    const cy = 560;
    const burst = ctx.createRadialGradient(cx, cy, 20, cx, cy, 900);
    burst.addColorStop(0, rgba(accent, 0.55));
    burst.addColorStop(0.45, rgba(accent, 0.14));
    burst.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = burst;
    ctx.fillRect(0, 0, CARD_W, 780);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CARD_W, 760);
    ctx.clip();
    ctx.translate(cx, cy);
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2 + (i % 3) * 0.013;
      const spread = 0.012 + ((i * 7) % 5) * 0.004;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 150, Math.sin(a) * 150);
      ctx.lineTo(Math.cos(a - spread) * 1400, Math.sin(a - spread) * 1400);
      ctx.lineTo(Math.cos(a + spread) * 1400, Math.sin(a + spread) * 1400);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : rgba(accent, 0.1);
      ctx.fill();
    }
    ctx.restore();
    const fade = ctx.createLinearGradient(0, 380, 0, 780);
    fade.addColorStop(0, 'rgba(8,8,12,0)');
    fade.addColorStop(1, BG);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 380, CARD_W, 401);
  } else {
    // Minimal: dark with a fine dot grid and one line of the tier colour.
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 40; y < CARD_H; y += 36) for (let x = 40; x < CARD_W; x += 36) ctx.fillRect(x, y, 2, 2);
    const line = ctx.createLinearGradient(0, 0, CARD_W, 0);
    line.addColorStop(0, rgba(accent, 0));
    line.addColorStop(0.5, rgba(accent, 0.9));
    line.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = line;
    ctx.fillRect(0, 0, CARD_W, 6);
    const halo = ctx.createRadialGradient(CARD_W / 2, 0, 10, CARD_W / 2, 0, 700);
    halo.addColorStop(0, rgba(accent, 0.18));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, CARD_W, 700);
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
  const chip = `LV ${level} · REVIEWER`;
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

  // ── Stats, big numbers between thin dividers
  const stats = [{ label: 'Reviews', value: data.countedReviews.toLocaleString('en-US') }, ...data.stats].slice(0, 4);
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
    progress.next ? `${progress.remaining.toLocaleString('en-US')} more reviews to ${progress.next.name}` : 'Every level unlocked',
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
