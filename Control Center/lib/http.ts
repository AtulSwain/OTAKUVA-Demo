import { NextResponse, type NextRequest } from 'next/server';
import type { AuthenticatedUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ControlEditError } from './editor';
import { requireControl } from './access';
import { refreshSite } from './publish';

export const NO_STORE = { 'Cache-Control': 'no-store' };

export function controlError(err: unknown, route: string) {
  if (err instanceof ControlEditError) return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
  logger.error('Control center request failed', { error: err as Error, route });
  return NextResponse.json({ error: 'Something went wrong.' }, { status: 500, headers: NO_STORE });
}

export const pageParams = (sp: URLSearchParams, max = 50) => {
  const page = Math.max(1, Number.parseInt(sp.get('page') || '1', 10) || 1);
  const limit = Math.min(max, Math.max(1, Number.parseInt(sp.get('limit') || '30', 10) || 30));
  return { page, limit, skip: (page - 1) * limit };
};

type Ctx = { params: Record<string, string> };

/**
 * Wraps a control-center handler: ADMIN+ check first, JSON + no-store on the
 * way out, ControlEditError → its status, anything else → logged 500.
 */
export function guarded(route: string, fn: (req: NextRequest, auth: AuthenticatedUser, ctx: Ctx) => Promise<unknown>) {
  return async (req: NextRequest, ctx: Ctx = { params: {} }) => {
    const auth = await requireControl(req);
    if (auth instanceof NextResponse) return auth;
    try {
      const out = await fn(req, auth, ctx);
      // Every successful change is pushed to the live site at once.
      if (req.method !== 'GET' && !(out instanceof Response && !out.ok)) {
        const o = (out && typeof out === 'object' ? out : {}) as { id?: unknown; slug?: unknown };
        refreshSite([o.id, o.slug].filter((k): k is string => typeof k === 'string'));
      }
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true }, { headers: NO_STORE });
    } catch (e) {
      return controlError(e, route);
    }
  };
}

/** The JSON body, or {} when missing/invalid. */
export const body = async (req: NextRequest): Promise<Record<string, unknown>> => {
  const b = await req.json().catch(() => ({}));
  return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
};
