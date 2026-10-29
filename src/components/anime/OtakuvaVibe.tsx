'use client';

import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { RATING_TIERS } from '../../lib/rating/ratingTiers';
import { VIBE_GRADE_LABEL, type VibeAspect, type VibeGrade, type VibeSummary } from '../../lib/rating/vibeGrades';
import styles from './OtakuvaVibe.module.css';

/**
 * Each aspect keeps its own colour (owner, 2026-10-25) so a slice is
 * recognisable as "Story" or "Music" at a glance. Data colours only — the
 * site theme stays black & grey.
 */
const ASPECT_COLORS: Record<string, string> = {
  STORY: '#7C8CF8',
  CHARACTERS: '#F27FB2',
  ANIMATION: '#38BDF8',
  MUSIC: '#A78BFA',
  PACING: '#34D399',
  WORLD_BUILDING: '#FBBF24',
  ENJOYMENT: '#FB923C',
};
const SHORT: Record<string, string> = { WORLD_BUILDING: 'World' };
const ORDER = ['STORY', 'CHARACTERS', 'ANIMATION', 'MUSIC', 'PACING', 'WORLD_BUILDING', 'ENJOYMENT'];
const aspectColor = (category: string) => ASPECT_COLORS[category] ?? '#A1A1AA';
const tier = (g: VibeGrade) => RATING_TIERS.find((t) => t.id === g);

/**
 * Plain-language "what to expect" lines (owner, 2026-10-27: no member
 * counts — tell people what the grades mean). Worded from the grade alone;
 * nothing here is invented about the show itself.
 */
type Band = 'high' | 'mid' | 'avg' | 'low';
const band = (g: VibeGrade): Band => (g === 'GREAT' || g === 'GOOD' ? 'high' : g === 'DECENT' ? 'mid' : g === 'AVERAGE' ? 'avg' : 'low');
const EXPECT: Record<string, Record<Band, string>> = {
  STORY: { high: 'A gripping plot that keeps you coming back.', mid: 'A solid plot with a few slower stretches.', avg: 'An ordinary plot — fine, not memorable.', low: 'The plot is the weak point.' },
  CHARACTERS: { high: 'A memorable cast you’ll get attached to.', mid: 'A likeable cast, with some flat roles.', avg: 'A cast that does the job, nothing more.', low: 'The characters struggle to stand out.' },
  ANIMATION: { high: 'Striking visuals and fluid animation.', mid: 'Clean animation, rarely stunning.', avg: 'Average-looking animation.', low: 'Visuals feel rough or inconsistent.' },
  MUSIC: { high: 'A soundtrack that lifts the big moments.', mid: 'Fitting music, not very memorable.', avg: 'Music that stays in the background.', low: 'The music doesn’t leave much of a mark.' },
  PACING: { high: 'Moves well — hard to stop watching.', mid: 'Mostly steady, with some drag.', avg: 'Uneven pacing in places.', low: 'The pacing drags or rushes.' },
  WORLD_BUILDING: { high: 'A rich world worth getting lost in.', mid: 'The setting works but stays in the background.', avg: 'A familiar setting without much depth.', low: 'The world feels thin.' },
  ENJOYMENT: { high: 'People had a great time with it.', mid: 'Enjoyable if you’re in the right mood.', avg: 'Opinions are split on how fun it is.', low: 'Most found it hard to enjoy.' },
};
/** What each aspect covers, for the tap-for-details card (2026-10-27). */
const ASPECT_ABOUT: Record<string, string> = {
  STORY: 'The plot: its twists, stakes and how well it is told.',
  CHARACTERS: 'The cast: how memorable, believable and well written they are.',
  ANIMATION: 'The visuals: art, motion, direction and consistency.',
  MUSIC: 'The soundtrack, openings, endings and sound design.',
  PACING: 'How the story moves: whether it drags or rushes.',
  WORLD_BUILDING: 'The setting: how rich and believable the world feels.',
  ENJOYMENT: 'Plain fun: how much people enjoyed watching it.',
};
const expectLine = (a: VibeAspect) => EXPECT[a.category]?.[band(a.grade)] ?? '';
/** One-line verdict for the overall grade. */
const OVERALL_LINE: Record<VibeGrade, string> = {
  GREAT: 'Highly recommended',
  GOOD: 'Worth watching',
  DECENT: 'Enjoyable',
  AVERAGE: 'Mixed feelings',
  WORST: 'Hard to recommend',
};

interface Slice {
  aspect: VibeAspect;
  index: number;
  color: string;
  start: number; // degrees, 0 = top, clockwise
  end: number;
  mid: number;
  /** Share of the ring: how strongly this aspect is rated, relative to the others. */
  share: number;
}

function buildSlices(aspects: VibeAspect[]): Slice[] {
  const ordered = [...aspects].sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category));
  const total = ordered.reduce((s, a) => s + a.averageScore, 0) || 1;
  let at = 0;
  return ordered.map((aspect, i) => {
    const sweep = (aspect.averageScore / total) * 360;
    const slice: Slice = { aspect, index: i + 1, color: aspectColor(aspect.category), start: at, end: at + sweep, mid: at + sweep / 2, share: Math.round((aspect.averageScore / total) * 100) };
    at += sweep;
    return slice;
  });
}

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

function arcPath(cx: number, cy: number, R: number, r: number, a: number, b: number, gap: number) {
  const s = a + gap / 2;
  const e = Math.max(s + 0.1, b - gap / 2);
  const large = e - s > 180 ? 1 : 0;
  const p1 = polar(cx, cy, R, s);
  const p2 = polar(cx, cy, R, e);
  const p3 = polar(cx, cy, r, e);
  const p4 = polar(cx, cy, r, s);
  return `M ${p1.x} ${p1.y} A ${R} ${R} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${r} ${r} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
}

/** Geometry for one canvas size (laptop or phone). */
interface Layout {
  W: number;
  H: number;
  R: number;
  r: number;
  /** Horizontal distance from the ring edge to the label column. */
  labelGap: number;
  /** Vertical room per label. */
  line: number;
  narrow: boolean;
}
// Bigger ring, no segment numbers (owner, 2026-10-26).
const WIDE: Layout = { W: 820, H: 460, R: 156, r: 104, labelGap: 64, line: 46, narrow: false };
const NARROW: Layout = { W: 400, H: 390, R: 102, r: 68, labelGap: 22, line: 46, narrow: true };

function VibeCanvas({
  layout,
  slices,
  active,
  onSelect,
  overall,
  mine,
}: {
  layout: Layout;
  slices: Slice[];
  active: string | null;
  onSelect: (category: string | null) => void;
  overall: VibeGrade | null;
  mine: VibeSummary['mine'];
}) {
  const { W, H, R, r, labelGap, line, narrow } = layout;
  const cx = W / 2;
  const cy = H / 2;
  const gap = slices.length > 1 ? 2.4 : 0;
  const activeSlice = slices.find((s) => s.aspect.category === active) ?? null;
  const uid = narrow ? 'vibe-n' : 'vibe-w';
  const glowColor = activeSlice?.color ?? (overall ? tier(overall)?.color : undefined) ?? '#ffffff';

  // Callout positions, de-overlapped per side.
  const items = slices.map((s) => {
    const right = s.mid < 180;
    return { s, right, edge: polar(cx, cy, R + 6, s.mid), elbow: polar(cx, cy, R + (narrow ? 16 : 26), s.mid), y: polar(cx, cy, R + (narrow ? 16 : 26), s.mid).y };
  });
  for (const side of [true, false]) {
    const group = items.filter((i) => i.right === side).sort((a, b) => a.y - b.y);
    for (let i = 1; i < group.length; i++) if (group[i].y - group[i - 1].y < line) group[i].y = group[i - 1].y + line;
  }
  const xRight = cx + R + labelGap;
  const xLeft = cx - R - labelGap;

  const pick = (category: string) => onSelect(active === category ? null : category);
  const keyPick = (e: React.KeyboardEvent, category: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(category);
    }
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={narrow ? styles.chartNarrow : styles.chartWide} role="group" aria-label="OTAKUVA Vibe chart">
      <defs>
        {/* Each segment is shaded lighter toward its outer edge (a little depth). */}
        {slices.map((s) => (
          <radialGradient key={s.aspect.category} id={`${uid}-${s.aspect.category}`} cx={cx} cy={cy} r={R} gradientUnits="userSpaceOnUse">
            <stop offset={`${Math.round((r / R) * 100)}%`} stopColor={s.color} stopOpacity={0.78} />
            <stop offset="100%" stopColor={s.color} />
          </radialGradient>
        ))}
        <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={glowColor} stopOpacity={0.14} />
          <stop offset="100%" stopColor="#000" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Soft glow behind the ring, tinted by the overall grade (or the picked aspect). */}
      <circle cx={cx} cy={cy} r={R + (narrow ? 36 : 56)} fill={`url(#${uid}-glow)`} className={styles.glow} />
      {/* Fine tick ring around the chart. */}
      <circle cx={cx} cy={cy} r={R + (narrow ? 9 : 13)} className={styles.tickRing} />
      {Array.from({ length: 72 }, (_, i) => {
        const major = i % 6 === 0;
        const a = polar(cx, cy, R + (narrow ? 6 : 9), i * 5);
        const b = polar(cx, cy, R + (narrow ? (major ? 12 : 9) : major ? 17 : 13), i * 5);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={major ? styles.tickMajor : styles.tick} />;
      })}

      {/* Segments */}
      {slices.map((s) => {
        const on = active === s.aspect.category;
        const dim = active !== null && !on;
        const push = polar(0, 0, on ? (narrow ? 7 : 10) : 0, s.mid); // pop the picked slice outward
        return (
          <g
            key={s.aspect.category}
            className={styles.seg}
            style={{ transform: `translate(${push.x}px, ${push.y}px)`, opacity: dim ? 0.35 : 1 }}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`${s.aspect.label}: ${VIBE_GRADE_LABEL[s.aspect.grade]}, ${s.share}%`}
            onClick={() => pick(s.aspect.category)}
            onKeyDown={(e) => keyPick(e, s.aspect.category)}
          >
            <path d={arcPath(cx, cy, R, r, s.start, s.end, gap)} fill={`url(#${uid}-${s.aspect.category})`} />
            {/* Thin bright rim on the outer edge. */}
            <path d={arcPath(cx, cy, R, R - (narrow ? 2 : 3), s.start, s.end, gap)} fill="#fff" opacity={0.18} />
            <path d={arcPath(cx, cy, r + (narrow ? 5 : 7), r, s.start, s.end, gap)} fill="#000" opacity={0.22} />
          </g>
        );
      })}

      {/* Centre: overall, or the picked aspect */}
      <g onClick={() => onSelect(null)} className={styles.center}>
        <circle cx={cx} cy={cy} r={r - (narrow ? 7 : 10)} className={styles.centerDisc} />
        <circle cx={cx} cy={cy} r={r - (narrow ? 7 : 10)} className={styles.centerEdge} />
        {activeSlice ? (
          <>
            <text x={cx} y={cy - (narrow ? 22 : 28)} textAnchor="middle" className={narrow ? styles.centerKickerSm : styles.centerKicker} fill={activeSlice.color}>
              {activeSlice.aspect.label.toUpperCase()}
            </text>
            <text x={cx} y={cy + (narrow ? 2 : 4)} textAnchor="middle" className={narrow ? styles.centerGradeSm : styles.centerGrade} fill={tier(activeSlice.aspect.grade)?.color}>
              {VIBE_GRADE_LABEL[activeSlice.aspect.grade]}
            </text>
            <text x={cx} y={cy + (narrow ? 18 : 24)} textAnchor="middle" className={narrow ? styles.centerSubSm : styles.centerSub}>
              {`${activeSlice.share}% of the vibe`}
            </text>
            <text x={cx} y={cy + (narrow ? 31 : 40)} textAnchor="middle" className={narrow ? styles.centerSubSm : styles.centerSub}>
              {mine[activeSlice.aspect.category]
                ? `You: ${VIBE_GRADE_LABEL[mine[activeSlice.aspect.category]!]}`
                : ({ high: 'A highlight', mid: 'Holds up', avg: 'Middle of the pack', low: 'Weaker side' } as Record<Band, string>)[band(activeSlice.aspect.grade)]}
            </text>
          </>
        ) : (
          <>
            <text x={cx} y={cy - (narrow ? 15 : 22)} textAnchor="middle" className={narrow ? styles.centerKickerSm : styles.centerKicker}>
              OVERALL VIBE
            </text>
            <text x={cx} y={cy + (narrow ? 5 : 6)} textAnchor="middle" className={narrow ? styles.centerGradeSm : styles.centerGrade} fill={overall ? tier(overall)?.color : '#a1a1aa'}>
              {overall ? VIBE_GRADE_LABEL[overall] : '—'}
            </text>
            <text x={cx} y={cy + (narrow ? 22 : 30)} textAnchor="middle" className={narrow ? styles.centerSubSm : styles.centerSub}>
              {overall ? OVERALL_LINE[overall] : 'Not graded yet'}
            </text>
          </>
        )}
      </g>

      {/* Callouts: dot + elbow line + name, grade, share */}
      {items.map(({ s, right, edge, elbow, y }) => {
        const x = right ? xRight : xLeft;
        const anchor = right ? 'start' : 'end';
        const tx = right ? x + 7 : x - 7;
        const t = tier(s.aspect.grade);
        const on = active === s.aspect.category;
        const dim = active !== null && !on;
        const name = narrow ? SHORT[s.aspect.category] ?? s.aspect.label : s.aspect.label;
        return (
          <g
            key={s.aspect.category}
            className={styles.callout}
            style={{ opacity: dim ? 0.35 : 1 }}
            onClick={() => pick(s.aspect.category)}
            role="button"
            tabIndex={-1}
          >
            <polyline points={`${edge.x},${edge.y} ${elbow.x},${elbow.y} ${x},${y}`} className={styles.leader} stroke={s.color} />
            <circle cx={edge.x} cy={edge.y} r={narrow ? 3 : 3.5} fill={s.color} />
            <circle cx={x} cy={y} r={narrow ? 3.5 : 4} fill={s.color} />
            {/* The label says which colour is which aspect (owner, 2026-10-25);
                the grade and share only appear for the tapped one. */}
            <text
              x={tx}
              y={on ? y - (narrow ? 5 : 6) : y + (narrow ? 4 : 5)}
              textAnchor={anchor}
              className={narrow ? styles.calloutNameSm : styles.calloutName}
              style={{ fill: s.color }}
            >
              {name}
            </text>
            {on && (
              <text x={tx} y={y + (narrow ? 10 : 12)} textAnchor={anchor} className={narrow ? styles.calloutMetaSm : styles.calloutMeta}>
                <tspan fill={t?.color}>{VIBE_GRADE_LABEL[s.aspect.grade]}</tspan>
                <tspan className={styles.calloutShare}>{` · ${s.share}%`}</tspan>
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * OTAKUVA Vibe — what to expect from this anime, aspect by aspect, as grades.
 * Infographic ring (owner, 2026-10-25): one coloured segment per aspect with a
 * small gap, sized by how strongly it's rated; numbered; callouts with name,
 * grade and share. The same chart on laptop and phone (phone has its own,
 * tighter geometry). Tap a segment or label: it pops out and the centre shows
 * that aspect (grade, share, your grade); tap again to go back.
 * Data: GET /api/anime/:id/vibe. "What's your vibe?" opens VibeModal.
 */
export const OtakuvaVibe: React.FC<{
  vibe: VibeSummary | null;
  onOpenVibe?: () => void;
  canRate?: boolean;
}> = ({ vibe, onOpenVibe, canRate = true }) => {
  const [active, setActive] = useState<string | null>(null);
  const aspects = vibe?.aspects ?? [];
  const mine = vibe?.mine ?? {};
  const myCount = Object.keys(mine).length;
  const slices = buildSlices(aspects);

  const activeSlice = slices.find((sl) => sl.aspect.category === active) ?? null;

  return (
    <section className={styles.section} aria-label="OTAKUVA Vibe">
      <div className={styles.head}>
        <h2 className={styles.title}>OTAKUVA Vibe</h2>
      </div>

      {canRate && onOpenVibe && (
        <button type="button" className={styles.prompt} onClick={onOpenVibe}>
          <span className={styles.promptIcon} aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <span className={styles.promptText}>
            <strong>{myCount > 0 ? 'Your vibe about this anime' : "What's your vibe about this anime?"}</strong>
            {myCount > 0 && <small>{`You graded ${myCount} of 7 parts`}</small>}
          </span>
          <span className={styles.promptCta}>{myCount > 0 ? 'Edit' : 'Share your vibe'}</span>
        </button>
      )}

      {aspects.length === 0 ? (
        <p className={styles.emptyNote}>No vibe yet — be the first to grade it.</p>
      ) : (
        <>
          <figure className={styles.chart}>
            <VibeCanvas layout={WIDE} slices={slices} active={active} onSelect={setActive} overall={vibe?.overall ?? null} mine={mine} />
            <VibeCanvas layout={NARROW} slices={slices} active={active} onSelect={setActive} overall={vibe?.overall ?? null} mine={mine} />
          </figure>

          {/* Tap a part of the circle → its details (owner, 2026-10-27; replaced
              the four tiles and the seven-line list). No member counts. */}
          {activeSlice && (
            <div
              className={styles.detail}
              style={{ ['--c' as string]: activeSlice.color }}
              role="region"
              aria-live="polite"
              aria-label={`${activeSlice.aspect.label} details`}
            >
              <div className={styles.detailHead}>
                <span className={styles.detailDot} aria-hidden="true" />
                <strong className={styles.detailName}>{activeSlice.aspect.label}</strong>
                <span className={styles.detailGrade} style={{ color: tier(activeSlice.aspect.grade)?.color }}>
                  {VIBE_GRADE_LABEL[activeSlice.aspect.grade]}
                </span>
                <button type="button" className={styles.detailClose} onClick={() => setActive(null)} aria-label="Close details">
                  <X size={15} />
                </button>
              </div>
              <p className={styles.detailWhat}>{ASPECT_ABOUT[activeSlice.aspect.category] ?? ''}</p>
              <p className={styles.detailExpect}>{expectLine(activeSlice.aspect)}</p>
              <dl className={styles.detailStats}>
                <div>
                  <dt>Members&apos; grade</dt>
                  <dd style={{ color: tier(activeSlice.aspect.grade)?.color }}>{VIBE_GRADE_LABEL[activeSlice.aspect.grade]}</dd>
                </div>
                <div>
                  <dt>Share of the vibe</dt>
                  <dd>{activeSlice.share}%</dd>
                </div>
                <div>
                  <dt>Your grade</dt>
                  <dd>{mine[activeSlice.aspect.category] ? VIBE_GRADE_LABEL[mine[activeSlice.aspect.category]!] : '—'}</dd>
                </div>
              </dl>
            </div>
          )}
        </>
      )}
    </section>
  );
};
