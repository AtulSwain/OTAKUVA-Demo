import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { logger } from '../../../../../lib/logger';
import { EpisodeWatchError, getWatchedEpisodes, setEpisodeWatched } from '../../../../../lib/library/episodeWatch';

export const dynamic = 'force-dynamic';

function fail(error: unknown, method: string) {
  if (error instanceof EpisodeWatchError) return NextResponse.json({ error: error.message }, { status: error.status });
  logger.error('Watched episodes request failed', { error, route: '/api/anime/[id]/watched-episodes', method });
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}

/** GET — the episode numbers the viewer has ticked as watched ([] for guests). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUserFromRequest(request);
    const numbers = user ? await getWatchedEpisodes(user.id, params.id) : [];
    return NextResponse.json({ numbers }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return fail(error, 'GET');
  }
}

/** POST { episodeNumber, watched } — tick / untick one episode (only that one). */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Sign in to save episode progress.' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await setEpisodeWatched(user.id, params.id, body?.episodeNumber, body?.watched));
  } catch (error) {
    return fail(error, 'POST');
  }
}
