import { NextRequest, NextResponse } from 'next/server';
import { studioService } from '../../../../lib/engine/studio/studioService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const projectsOnly = searchParams.get('projectsOnly') === 'true';

    const studio = await studioService.getStudioBySlugOrId(slug);

    if (!studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    if (projectsOnly) {
      const type = searchParams.get('type') || undefined;
      const role = searchParams.get('role') || undefined;
      const sortBy = (searchParams.get('sortBy') as any) || 'score';
      const sortOrder = (searchParams.get('sortOrder') as any) || 'desc';
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '20', 10);

      const projectsResult = await studioService.getStudioProjects(studio.id, {
        type,
        role,
        sortBy,
        sortOrder,
        page,
        limit,
      });

      return NextResponse.json(projectsResult);
    }

    // Compute stats & compatibility aliases
    const tvCount = studio.projects.filter((p) => (p.type || '').toUpperCase() === 'TV').length;
    const movieCount = studio.projects.filter((p) => (p.type || '').toUpperCase() === 'MOVIE').length;
    const ovaCount = studio.projects.filter((p) => ['OVA', 'ONA', 'SPECIAL'].includes((p.type || '').toUpperCase())).length;

    const scores = studio.projects.map((p) => p.score).filter((s): s is number => typeof s === 'number' && s > 0);
    const avgScore = scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : 8.2;

    const foundersList = studio.staff.map((s) => ({
      name: s.name,
      role: s.notes || s.role,
      slug: s.slug || s.name.toLowerCase().replace(/\s+/g, '-'),
      imageUrl: s.imageUrl,
    }));

    const responseStudio = {
      ...studio,
      totalWorks: studio.totalAnimeCount,
      animes: studio.projects.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.canonicalTitle,
        englishTitle: p.englishTitle,
        posterImage: p.posterUrl,
        posterUrl: p.posterUrl,
        score: p.score,
        episodes: p.episodes,
        type: p.type,
        status: p.status,
        year: p.year,
        isMainStudio: p.isMain,
      })),
      founders: foundersList,
      keyPersonnel: foundersList,
      history: studio.metadata?.history || {
        foundingEra: studio.about || 'Founded with a passion for distinctive animation.',
        goldenAge: 'Established standard-setting animation pipelines.',
        modernEra: 'Continuing to innovate modern Japanese television and film animation.',
      },
      timeline: studio.metadata?.timeline || [],
      dna: studio.metadata?.dna || {
        signatureStyle: 'High-production value animation with expressive character acting.',
        primaryGenres: ['Action', 'Drama', 'Fantasy', 'Sci-Fi'],
        artisticPhilosophy: 'Artistic integrity and director-driven storytelling.',
      },
      location: studio.region || studio.city ? `${studio.city ? studio.city + ', ' : ''}${studio.region || ''}` : studio.country || 'Japan',
      stats: {
        totalWorks: studio.totalAnimeCount,
        tvCount,
        movieCount,
        ovaCount,
        onaCount: ovaCount,
        averageScore: avgScore,
        topGenres: studio.metadata?.dna?.primaryGenres || ['Action', 'Drama', 'Fantasy'],
      },
    };

    return NextResponse.json({ studio: responseStudio });
  } catch (error: any) {
    console.error('Error fetching studio details:', error);
    return NextResponse.json({ error: 'Failed to fetch studio details' }, { status: 500 });
  }
}
