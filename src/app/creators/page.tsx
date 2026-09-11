import { redirect } from 'next/navigation';

/**
 * /creators used to render a hardcoded list of ten people with hand-written
 * bios and invented "notable works" counts. The real, database-backed people
 * directory is /artists (the navigation label the product uses), so old links
 * land there.
 */
export default function CreatorsRedirect() {
  redirect('/artists');
}
