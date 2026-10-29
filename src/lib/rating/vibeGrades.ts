/**
 * OTAKUVA Vibe grades — browser-safe constants and types (no database
 * imports), shared by the Vibe window/chart and the server (vibe.ts).
 */
import type { RatingCategoryType } from './ratingEngine';

export const VIBE_GRADES = ['WORST', 'AVERAGE', 'DECENT', 'GOOD', 'GREAT'] as const;
export type VibeGrade = (typeof VIBE_GRADES)[number];

/** The middle of each grade's band on the 1–10 scale (ratingTiers.ts). */
export const VIBE_GRADE_VALUE: Record<VibeGrade, number> = { WORST: 1.5, AVERAGE: 4.5, DECENT: 6.5, GOOD: 7.5, GREAT: 9 };
export const VIBE_GRADE_LABEL: Record<VibeGrade, string> = { WORST: 'Worst', AVERAGE: 'Average', DECENT: 'Decent', GOOD: 'Good', GREAT: 'Great' };

export const isVibeGrade = (v: unknown): v is VibeGrade => typeof v === 'string' && (VIBE_GRADES as readonly string[]).includes(v);

export interface VibeAspect {
  category: RatingCategoryType;
  label: string;
  /** Averaged value (1–10) — used for the bar length and ordering only. */
  averageScore: number;
  grade: VibeGrade;
  responseCount: number;
  /** Share of all aspect votes, for the circle's slices. */
  percentage: number;
}

export interface VibeSummary {
  aspects: VibeAspect[];
  /** Different members who gave any aspect. */
  members: number;
  /** Overall grade: the average of the aspect averages. */
  overall: VibeGrade | null;
  /** The viewer's own grades, by aspect. */
  mine: Partial<Record<RatingCategoryType, VibeGrade>>;
}
