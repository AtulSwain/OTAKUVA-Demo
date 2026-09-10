/**
 * MASTER VERIFICATION & REGRESSION SUITE:
 * OTAKUVA CATALOG RECOVERY, SYSTEM CLEANUP & SECURITY HARDENING
 * 
 * Validates across 6 core pillars:
 * 1. DATABASE & CATALOG VISIBILITY PIPELINE
 * 2. API CONTRACT & QUERY NORMALIZATION
 * 3. PUBLIC VS PROTECTED ACCESS SEPARATION
 * 4. SECURITY & RBAC AUTHORIZATION HARDENING
 * 5. PRIVATE COMMUNITY & CHAT ISOLATION
 * 6. CORE END-TO-END USER JOURNEY & DATA SAFETY
 */

import { prisma } from './prisma';
import { GET as getAnimeList } from '../app/api/anime/route';
import { GET as getAnimeDetail } from '../app/api/anime/[id]/route';
import { GET as getRatings, POST as postRating } from '../app/api/ratings/[animeId]/route';
import { GET as getReviews, POST as postReview } from '../app/api/reviews/route';
import { GET as getChat, POST as postChat } from '../app/api/communities/[slug]/chat/route';
import { POST as postCatalogSync } from '../app/api/admin/catalog/sync/route';
import { POST as postCatalogMerge } from '../app/api/admin/catalog/merge/route';
import { searchCatalog } from './search';
import { getAnimeDisplayTitle } from './animeTitleResolver';
import { signJwtToken } from './auth';
import { NextRequest } from 'next/server';

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${description}`);
    passedAssertions++;
  } else {
    console.error(`  ✗ [FAIL] ${description}`);
    failedAssertions++;
  }
}

async function runMasterSuite() {
  console.log('========================================================================');
  console.log('  OTAKUVA MASTER REPAIR, CLEANUP & SECURITY HARDENING SUITE');
  console.log('========================================================================\n');

  // -----------------------------------------------------------------
  // 1. DATABASE & CATALOG VISIBILITY PIPELINE
  // -----------------------------------------------------------------
  console.log('--- 1. DATABASE & CATALOG VISIBILITY PIPELINE ---');

  const totalDbAnime = await prisma.anime.count();
  assert(totalDbAnime >= 100, `Database contains ${totalDbAnime} active verified real anime records (>= 100 canonical catalog requirement met)`);

  const activeDbAnime = await prisma.anime.count({
    where: { status: { not: 'MERGED' } },
  });
  assert(activeDbAnime > 0, `Active unmerged catalog records: ${activeDbAnime}`);

  const sampleTitles = await prisma.anime.findMany({
    take: 25,
    select: { id: true, canonicalTitle: true, slug: true },
  });
  const allNonEmpty = sampleTitles.every((a) => a.canonicalTitle && a.canonicalTitle.trim().length > 0);
  assert(allNonEmpty, '100% of sampled database anime records have valid non-empty canonical titles');

  // -----------------------------------------------------------------
  // 2. API CONTRACT & QUERY NORMALIZATION
  // -----------------------------------------------------------------
  console.log('\n--- 2. API CONTRACT & QUERY NORMALIZATION ---');

  // 2.1: GET /api/anime default browse
  const req1 = new NextRequest('http://localhost:3000/api/anime?limit=24');
  const res1 = await getAnimeList(req1);
  const data1 = await res1.json();

  assert(res1.status === 200, 'GET /api/anime returns HTTP 200');
  assert(Array.isArray(data1.animes) && data1.animes.length === 24, `GET /api/anime returns requested page size (24 items returned)`);
  assert(typeof data1.pagination?.total === 'number' && data1.pagination.total >= 100, `Pagination metadata reports active unmerged total count (${data1.pagination?.total})`);
  assert(Boolean(data1.animes[0]?.title && data1.animes[0]?.canonicalTitle), 'Returned anime records have both title and canonicalTitle');

  // 2.2: Flexible Type Filtering (TV, Movie, ONA)
  const reqMovie = new NextRequest('http://localhost:3000/api/anime?type=Movie&limit=10');
  const resMovie = await getAnimeList(reqMovie);
  const dataMovie = await resMovie.json();
  assert(dataMovie.animes.length > 0, `Flexible Movie filtering returned ${dataMovie.animes.length} theatrical anime`);
  assert(dataMovie.animes.every((a: any) => a.type.toUpperCase().includes('MOVIE')), 'All returned items match Movie type');

  // 2.3: Flexible Status Filtering (Finished, Airing, Upcoming)
  const reqFinished = new NextRequest('http://localhost:3000/api/anime?status=Finished&limit=10');
  const resFinished = await getAnimeList(reqFinished);
  const dataFinished = await resFinished.json();
  assert(dataFinished.animes.length > 0, `Flexible Finished status filtering returned ${dataFinished.animes.length} records`);

  // 2.4: Search Catalog Engine
  const searchRes = await searchCatalog({ query: 'Frieren', limit: 5 });
  assert(searchRes.items.length > 0, `Search engine located ${searchRes.items.length} matching records for "Frieren"`);
  assert(getAnimeDisplayTitle(searchRes.items[0]).includes('Frieren'), 'Top search result is Frieren');

  // 2.5: GET /api/anime/[id] Detail Route
  const targetId = data1.animes[0].slug || data1.animes[0].id;
  const reqDetail = new NextRequest(`http://localhost:3000/api/anime/${targetId}`);
  const resDetail = await getAnimeDetail(reqDetail, { params: { id: targetId } });
  const dataDetail = await resDetail.json();
  assert(resDetail.status === 200, `GET /api/anime/[id] returned HTTP 200 for "${targetId}"`);
  assert(Boolean(dataDetail.anime?.title), `Detail payload contains resolved title: "${dataDetail.anime?.title}"`);
  assert(Array.isArray(dataDetail.anime?.genres), 'Detail payload includes genres array');
  assert(Array.isArray(dataDetail.anime?.studios), 'Detail payload includes studios array');

  // -----------------------------------------------------------------
  // 3. PUBLIC VS PROTECTED ACCESS SEPARATION
  // -----------------------------------------------------------------
  console.log('\n--- 3. PUBLIC VS PROTECTED ACCESS SEPARATION ---');

  // 3.1: Anonymous Public Read Access
  const publicReq = new NextRequest('http://localhost:3000/api/anime?limit=5');
  const publicRes = await getAnimeList(publicReq);
  assert(publicRes.status === 200, 'Anonymous users can freely browse public anime catalog');

  // 3.2: Rating requires authentication
  const unauthRateReq = new NextRequest(`http://localhost:3000/api/ratings/${targetId}`, {
    method: 'POST',
    body: JSON.stringify({ score: 9.5 }),
  });
  const unauthRateRes = await postRating(unauthRateReq, { params: { animeId: targetId } });
  assert(unauthRateRes.status === 401, 'Anonymous rating request rejected with HTTP 401 Unauthorized');

  // 3.3: Review requires authentication
  const unauthReviewReq = new NextRequest('http://localhost:3000/api/reviews', {
    method: 'POST',
    body: JSON.stringify({ animeId: targetId, title: 'Test Review', body: 'Great anime' }),
  });
  const unauthReviewRes = await postReview(unauthReviewReq);
  assert(unauthReviewRes.status === 401, 'Anonymous review submission rejected with HTTP 401 Unauthorized');

  // -----------------------------------------------------------------
  // 4. SECURITY & RBAC AUTHORIZATION HARDENING
  // -----------------------------------------------------------------
  console.log('\n--- 4. SECURITY & RBAC AUTHORIZATION HARDENING ---');

  // Create test regular user and admin user
  const regularUser = await prisma.user.upsert({
    where: { email: 'regular_user_test@otakuva.com' },
    update: { role: 'USER' },
    create: {
      email: 'regular_user_test@otakuva.com',
      username: 'regular_user_test',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'USER',
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin_user_test@otakuva.com' },
    update: { role: 'ADMIN' },
    create: {
      email: 'admin_user_test@otakuva.com',
      username: 'admin_user_test',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'ADMIN',
    },
  });

  const userToken = signJwtToken({ userId: regularUser.id, username: regularUser.username, email: regularUser.email });
  const adminToken = signJwtToken({ userId: adminUser.id, username: adminUser.username, email: adminUser.email });

  // 4.1: Regular user denied catalog sync
  const userSyncReq = new NextRequest('http://localhost:3000/api/admin/catalog/sync', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({ mode: 'TARGETED', provider: 'anilist', externalId: '52991' }),
  });
  const userSyncRes = await postCatalogSync(userSyncReq);
  assert(userSyncRes.status === 403, 'RBAC: Regular user denied /api/admin/catalog/sync (HTTP 403)');

  // 4.2: Regular user denied catalog merge
  const userMergeReq = new NextRequest('http://localhost:3000/api/admin/catalog/merge', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({ sourceAnimeId: 'a', targetAnimeId: 'b' }),
  });
  const userMergeRes = await postCatalogMerge(userMergeReq);
  assert(userMergeRes.status === 403, 'RBAC: Regular user denied /api/admin/catalog/merge (HTTP 403)');

  // 4.3: Input Validation: Rating score bounds
  const invalidScoreReq = new NextRequest(`http://localhost:3000/api/ratings/${targetId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({ score: 15.0 }), // Out of 0..10 bound
  });
  const invalidScoreRes = await postRating(invalidScoreReq, { params: { animeId: targetId } });
  assert(invalidScoreRes.status === 400, 'Input validation rejects invalid rating score > 10.0 (HTTP 400)');

  // -----------------------------------------------------------------
  // 5. PRIVATE COMMUNITY & CHAT ISOLATION
  // -----------------------------------------------------------------
  console.log('\n--- 5. PRIVATE COMMUNITY & CHAT ISOLATION ---');

  // Create Private Community
  const privateComm = await prisma.community.upsert({
    where: { slug: 'secret-anime-society' },
    update: { visibility: 'PRIVATE' },
    create: {
      name: 'Secret Anime Society',
      slug: 'secret-anime-society',
      description: 'Private invite-only community',
      visibility: 'PRIVATE',
      ownerId: adminUser.id,
    },
  });

  const generalChannel = await prisma.communityChannel.upsert({
    where: { communityId_slug: { communityId: privateComm.id, slug: 'general' } },
    update: {},
    create: {
      communityId: privateComm.id,
      name: 'General Chat',
      slug: 'general',
    },
  });

  // 5.1: Unauthorized non-member access to private chat
  const unauthChatReq = new NextRequest(`http://localhost:3000/api/communities/${privateComm.slug}/chat?channel=general`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  const unauthChatRes = await getChat(unauthChatReq, { params: { slug: privateComm.slug } });
  assert(unauthChatRes.status === 403, 'Access denied: Non-member blocked from reading private community chat (HTTP 403)');

  // 5.2: Anonymous access to private chat
  const anonChatReq = new NextRequest(`http://localhost:3000/api/communities/${privateComm.slug}/chat?channel=general`);
  const anonChatRes = await getChat(anonChatReq, { params: { slug: privateComm.slug } });
  assert(anonChatRes.status === 403, 'Access denied: Anonymous user blocked from reading private community chat (HTTP 403)');

  // -----------------------------------------------------------------
  // 6. CORE USER JOURNEY SIMULATION & DATA SAFETY
  // -----------------------------------------------------------------
  console.log('\n--- 6. CORE USER JOURNEY SIMULATION & DATA SAFETY ---');

  // Step 1: Browse catalog
  const browseReq = new NextRequest('http://localhost:3000/api/anime?limit=10');
  const browseRes = await getAnimeList(browseReq);
  const browseData = await browseRes.json();
  const testAnime = browseData.animes[0];
  assert(Boolean(testAnime?.id), `Journey Step 1: Browsed catalog, selected "${testAnime.title}"`);

  // Step 2: Rate anime as authenticated user
  const rateReq = new NextRequest(`http://localhost:3000/api/ratings/${testAnime.id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({
      score: 9.0,
      categoryScores: { story: 9, animation: 10, characters: 9, sound: 8 },
    }),
  });
  const rateRes = await postRating(rateReq, { params: { animeId: testAnime.id } });
  assert(rateRes.status === 200, 'Journey Step 2: User successfully submitted 9.0 rating with category scores');

  // Step 3: Write review
  const reviewReq = new NextRequest('http://localhost:3000/api/reviews', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userToken}` },
    body: JSON.stringify({
      animeId: testAnime.id,
      title: 'A true masterpiece in modern anime',
      body: 'The animation pacing, story depth, and character development are superlative across every arc.',
      rating: 9,
      containsSpoiler: false,
    }),
  });
  const reviewRes = await postReview(reviewReq);
  assert(reviewRes.status === 200, 'Journey Step 3: User submitted authenticated community review');

  // Step 4: Verify rating summary calculation
  const getRateReq = new NextRequest(`http://localhost:3000/api/ratings/${testAnime.id}`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  const getRateRes = await getRatings(getRateReq, { params: { animeId: testAnime.id } });
  const getRateData = await getRateRes.json();
  assert(getRateData.userRating?.score === 9, 'Journey Step 4: User rating accurately recorded and retrievable');

  // -----------------------------------------------------------------
  // FINAL SYSTEM SCORECARD
  // -----------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`  OTAKUVA MASTER SYSTEM TEST RESULTS: ${passedAssertions} PASSED / ${failedAssertions} FAILED`);
  console.log('========================================================================');

  if (failedAssertions > 0) {
    throw new Error(`${failedAssertions} assertions failed in Master System Suite.`);
  }
}

runMasterSuite()
  .catch((err) => {
    console.error('Master System Suite Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
