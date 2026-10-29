/**
 * OTAKUVA Vibe (2026-10-25, owner): "What's your vibe about this anime?" —
 * a member picks a grade for each of the 7 aspects (Story, Characters,
 * Animation, Music, Pacing, World Building, Enjoyment). No 1–10 needed.
 *
 * The chart shows, per aspect, the members' grade: each member counts once
 * per aspect — their Vibe grade if they gave one, else the aspect score from
 * the older 1–10 rating window (so earlier votes aren't lost). Grades are
 * turned into the middle of their band to average them, and the average is
 * shown as a grade again (never as a number).
 */
import { prisma } from '../prisma';
import { ACTIVE_RATING_CATEGORIES, CATEGORY_LABELS, type RatingCategoryType } from './ratingEngine';
import { getRatingTier } from './ratingTiers';
import { getMemberScores } from './episodeRatings';

import { VIBE_GRADES, VIBE_GRADE_VALUE, VIBE_GRADE_LABEL, isVibeGrade, type VibeGrade, type VibeAspect, type VibeSummary } from './vibeGrades';
export { VIBE_GRADES, VIBE_GRADE_VALUE, VIBE_GRADE_LABEL, isVibeGrade };
export type { VibeGrade, VibeAspect, VibeSummary };

export const isVibeAspect = (v: unknown): v is RatingCategoryType =>
  typeof v === 'string' && (ACTIVE_RATING_CATEGORIES as readonly string[]).includes(v);

/** The grade for an averaged value (same bands as everywhere else). */
export function gradeFor(value: number): VibeGrade {
  const id = getRatingTier(value)?.id;
  return isVibeGrade(id) ? id : 'AVERAGE';
}

export async function getVibeSummary(animeId: string, viewerId?: string | null): Promise<VibeSummary> {
  const [vibes, legacy] = await Promise.all([
    // Plain SQL on purpose: works even in a server process that loaded the
    // Prisma client before the AnimeVibe table existed (no restart needed).
    prisma.$queryRaw<{ userId: string; category: string; grade: string }[]>`
      SELECT "userId", "category", "grade" FROM "AnimeVibe" WHERE "animeId" = ${animeId}`,
    getMemberScores(animeId),
  ]);

  // member → aspect → value (Vibe grade wins over an older aspect score)
  const byMember = new Map<string, Map<RatingCategoryType, number>>();
  for (const m of legacy) {
    for (const [cat, score] of Object.entries(m.categories) as [RatingCategoryType, number][]) {
      if (!isVibeAspect(cat) || typeof score !== 'number') continue;
      const row = byMember.get(m.userId) ?? new Map();
      row.set(cat, score);
      byMember.set(m.userId, row);
    }
  }
  const mine: VibeSummary['mine'] = {};
  for (const v of vibes) {
    if (!isVibeAspect(v.category) || !isVibeGrade(v.grade)) continue;
    const row = byMember.get(v.userId) ?? new Map();
    row.set(v.category, VIBE_GRADE_VALUE[v.grade]);
    byMember.set(v.userId, row);
    if (viewerId && v.userId === viewerId) mine[v.category] = v.grade;
  }

  const perAspect = new Map<RatingCategoryType, number[]>();
  for (const row of byMember.values()) {
    for (const [cat, value] of row) perAspect.set(cat, [...(perAspect.get(cat) ?? []), value]);
  }
  const totalVotes = Array.from(perAspect.values()).reduce((sum, l) => sum + l.length, 0);
  const aspects: VibeAspect[] = ACTIVE_RATING_CATEGORIES.filter((c) => (perAspect.get(c)?.length ?? 0) > 0)
    .map((category) => {
      const list = perAspect.get(category)!;
      const averageScore = list.reduce((a, b) => a + b, 0) / list.length;
      return {
        category,
        label: CATEGORY_LABELS[category],
        averageScore,
        grade: gradeFor(averageScore),
        responseCount: list.length,
        percentage: totalVotes ? Math.round((list.length / totalVotes) * 100) : 0,
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore);

  const overallValue = aspects.length ? aspects.reduce((s, a) => s + a.averageScore, 0) / aspects.length : null;
  return {
    aspects,
    members: Array.from(byMember.values()).filter((r) => r.size > 0).length,
    overall: overallValue === null ? null : gradeFor(overallValue),
    mine,
  };
}

export class VibeError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Saves the member's grades. `grades` maps aspect → grade; `null` removes
 * that aspect's grade. Unknown aspects or grades are refused.
 */
export async function saveVibe(userId: string, animeId: string, grades: unknown): Promise<void> {
  if (!grades || typeof grades !== 'object' || Array.isArray(grades)) throw new VibeError('Pick a grade for at least one aspect.', 400);
  const entries = Object.entries(grades as Record<string, unknown>);
  if (entries.length === 0) throw new VibeError('Pick a grade for at least one aspect.', 400);
  for (const [cat, grade] of entries) {
    if (!isVibeAspect(cat)) throw new VibeError(`Unknown aspect: ${cat}`, 400);
    if (grade !== null && !isVibeGrade(grade)) throw new VibeError(`Unknown grade for ${CATEGORY_LABELS[cat]}.`, 400);
  }
  // Plain SQL (see getVibeSummary). One statement per aspect, in one
  // transaction; the unique (userId, animeId, category) key makes a second
  // pick replace the first.
  await prisma.$transaction(
    entries.map(([category, grade]) =>
      grade === null
        ? prisma.$executeRaw`DELETE FROM "AnimeVibe" WHERE "userId" = ${userId} AND "animeId" = ${animeId} AND "category" = ${category}`
        : prisma.$executeRaw`
            INSERT INTO "AnimeVibe" ("id", "userId", "animeId", "category", "grade", "createdAt", "updatedAt")
            VALUES (gen_random_uuid()::text, ${userId}, ${animeId}, ${category}, ${grade as string}, NOW(), NOW())
            ON CONFLICT ("userId", "animeId", "category")
            DO UPDATE SET "grade" = EXCLUDED."grade", "updatedAt" = NOW()`
    )
  );
}
