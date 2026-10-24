import { getHomeData } from '../lib/home/getHomeData';
import { getAuthUserFromCookies } from '../lib/auth';
import { getBrowseList, getGenreArtwork } from '../lib/browseService';
import { HomeClient } from './HomeClient';

// Server component: every query behind the homepage runs here, at request
// time, so the response HTML already contains the content — no client-side
// fetch-after-hydrate waterfall. HomeClient (a client component) only owns
// the interactive bits (search, local times, auth-aware CTAs).
export default async function HomePage() {
  const authUser = await getAuthUserFromCookies();
  const [homeData, genreArt, choice] = await Promise.all([
    getHomeData(authUser),
    getGenreArtwork().catch(() => []),
    getBrowseList('choice', {}).catch(() => []),
  ]);

  // OTAKUVA Choice spotlight: the team's curated list, one title per day
  // (UTC), preferring titles with wide banner art.
  const withArt = choice.filter((c) => c.bannerUrl);
  const pool = withArt.length ? withArt : choice;
  const day = Math.floor(Date.now() / 86_400_000);
  const spotlight = pool.length ? pool[day % pool.length] : null;

  // getHomeData()'s return type is inferred from the raw Prisma mapping
  // (mapAnime), which is looser than HomeClient's HomeData shape.
  const initialSections = homeData.sections as any;

  return <HomeClient initialSections={initialSections} genreArt={genreArt} spotlight={spotlight} />;
}
