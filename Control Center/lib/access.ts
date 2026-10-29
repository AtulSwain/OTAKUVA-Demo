/**
 * Control center access (2026-10-28): the owner's admin console at /control.
 * ADMIN and SUPER_ADMIN only. Every /api/control/** route checks this
 * server-side; the page gate is only for showing the sign-in screen.
 */
import type { NextRequest, NextResponse } from 'next/server';
import { requireRole, type AuthenticatedUser } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';

export const CONTROL_MIN_ROLE = 'ADMIN' as const;

export const canUseControl = (role: string | null | undefined) => Boolean(role && hasMinRole(role, CONTROL_MIN_ROLE));

export function requireControl(request: NextRequest): Promise<AuthenticatedUser | NextResponse> {
  return requireRole(request, CONTROL_MIN_ROLE);
}

/** Images the console may store: https URLs, or files uploaded through it (/uploads/…). */
export function cleanImageUrl(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  // Files uploaded through the control center: local (/uploads/…) or the bucket relay (/api/media/…).
  if (/^\/(uploads|api\/media)\/[\w./-]+$/.test(v) && !v.includes('..')) return v;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && v.length <= 1000 ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** YouTube trailer link → canonical watch URL (the anime page embeds YouTube only). */
export function cleanTrailerUrl(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  const m =
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(v) || /^([A-Za-z0-9_-]{11})$/.exec(v);
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : undefined;
}
