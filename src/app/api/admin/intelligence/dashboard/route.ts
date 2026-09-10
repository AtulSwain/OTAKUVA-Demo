import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { hasMinRole } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { predictivePersonalizationEngine } from '@/lib/engine/ai/predictivePersonalizationEngine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/intelligence/dashboard
 * Admin AI/ML Platform Diagnostics & Model Registry Dashboard
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user || !hasMinRole(user.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized: Data Editor or Admin access required' }, { status: 403 });
    }

    const [models, embeddingCount, reviewAnalysisCount, predictionCount, performance] = await Promise.all([
      prisma.modelRegistry.findMany({ orderBy: { updatedAt: 'desc' } }),
      prisma.entityEmbedding.count({ where: { status: 'ACTIVE' } }),
      prisma.reviewAnalysis.count(),
      prisma.recommendationPrediction.count(),
      predictivePersonalizationEngine.evaluateModelPerformance(),
    ]);

    return NextResponse.json({
      success: true,
      health: 'HEALTHY',
      summary: {
        activeEmbeddings: embeddingCount,
        analyzedReviews: reviewAnalysisCount,
        loggedPredictions: predictionCount,
        registeredModelsCount: models.length,
      },
      models,
      performance,
    });
  } catch (error: any) {
    console.error('Admin intelligence dashboard API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to inspect AI intelligence platform' },
      { status: 500 }
    );
  }
}
