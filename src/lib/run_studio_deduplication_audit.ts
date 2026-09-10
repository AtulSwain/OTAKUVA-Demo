import { prisma } from './prisma';
import { studioDeduplicationService } from './engine/studio/studioDeduplicationService';

async function runAudit() {
  const totalStudios = await prisma.studio.count();
  const publishedStudios = await prisma.studio.count({ where: { publicationState: 'PUBLISHED' } });
  const mergedStudios = await prisma.studio.count({ where: { status: 'MERGED' } });
  const totalAliases = await prisma.studioAlias.count();
  const totalRedirects = await prisma.studioRedirect.count();
  const totalMerges = await prisma.studioMerge.count();
  const totalAnimeStudios = await prisma.animeStudio.count();
  const totalStaffRelations = await prisma.studioPerson.count();

  const scan = await studioDeduplicationService.scanForDuplicates({ minConfidence: 0.5 });

  console.log(JSON.stringify({
    totalStudios,
    publishedStudios,
    mergedStudios,
    totalAliases,
    totalRedirects,
    totalMerges,
    totalAnimeStudios,
    totalStaffRelations,
    scanTotalScanned: scan.totalScanned,
    definiteDuplicates: scan.definiteDuplicatesCount,
    highConfidenceDuplicates: scan.highConfidenceCount,
    manualReviewRequired: scan.manualReviewCount,
    totalClusters: scan.clusters.length,
    candidatePairsCount: scan.candidatePairs.length,
  }, null, 2));
}

runAudit().catch(console.error);
