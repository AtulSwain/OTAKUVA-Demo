async function testHomeApi() {
  const res = await fetch('http://localhost:3000/api/home');
  const json = await res.json();
  console.log('=== /api/home API RESPONSE INSPECTION ===');
  console.log('\n--- Top Rated in API ---');
  json.sections.topRated.forEach((a: any, i: number) => {
    console.log(`[${i + 1}] ID: ${a.id} | Slug: ${a.slug} | Title: "${a.title}" | Score: ${a.score} | Poster: ${a.posterUrl}`);
  });

  console.log('\n--- Trending in API ---');
  json.sections.trending.forEach((a: any, i: number) => {
    console.log(`[${i + 1}] ID: ${a.id} | Slug: ${a.slug} | Title: "${a.title}" | Score: ${a.score} | Poster: ${a.posterUrl}`);
  });
}

testHomeApi().catch(console.error);
