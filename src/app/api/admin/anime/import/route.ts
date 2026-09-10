import { NextRequest, NextResponse } from 'next/server';
import { JikanImportJobManager, ImportMode } from '../../../../../lib/ingestion/jikanImportJob';
import { prisma } from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const jobStatus = JikanImportJobManager.getStatus();
    const totalCatalogCount = await prisma.anime.count({ where: { status: { not: 'MERGED' } } });
    const studiosCount = await prisma.studio.count();
    const creatorsCount = await prisma.person.count();
    const charactersCount = await prisma.character.count();

    return NextResponse.json({
      job: jobStatus,
      catalogMetrics: {
        totalAnime: totalCatalogCount,
        totalStudios: studiosCount,
        totalCreators: creatorsCount,
        totalCharacters: charactersCount,
      },
    });
  } catch (err: any) {
    console.error('Admin Anime Import Status Error:', err);
    return NextResponse.json({ error: 'Failed to retrieve import status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'start'; // start, resume, stop, pause, reset, cancel
    const mode = (body.mode as ImportMode) || 'TOP';
    const startPage = body.startPage ? parseInt(body.startPage, 10) : undefined;
    const maxPages = body.maxPages ? parseInt(body.maxPages, 10) : 5;
    const specificId = body.specificId ? parseInt(body.specificId, 10) : undefined;

    if (action === 'stop' || action === 'pause') {
      const state = JikanImportJobManager.pauseJob();
      return NextResponse.json({ success: true, message: 'Import job paused', job: state });
    }

    if (action === 'cancel') {
      const state = JikanImportJobManager.cancelJob();
      return NextResponse.json({ success: true, message: 'Import job cancelled', job: state });
    }

    if (action === 'reset') {
      const state = JikanImportJobManager.resetJob();
      return NextResponse.json({ success: true, message: 'Import job reset', job: state });
    }

    // Default start or resume
    const state = await JikanImportJobManager.startOrResumeJob(mode, startPage, maxPages, specificId);
    return NextResponse.json({
      success: true,
      message: `Import job initiated (mode: ${mode}) from page ${state.currentPage}`,
      job: state,
    });
  } catch (err: any) {
    console.error('Admin Anime Import Action Error:', err);
    return NextResponse.json({ error: 'Failed to execute import action' }, { status: 500 });
  }
}
