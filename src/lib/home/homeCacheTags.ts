/** Cache tag on the homepage's public sections (getHomeData.ts); revalidate
 *  it whenever something those sections display changes, e.g. an OTAKUVA
 *  rating aggregate. Kept in its own module so the rating service can import
 *  it without pulling in the whole homepage loader. */
export const HOME_SECTIONS_CACHE_TAG = 'home-public-sections';
