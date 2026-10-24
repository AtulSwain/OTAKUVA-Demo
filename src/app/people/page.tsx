import { redirect } from 'next/navigation';

/**
 * /people used to render its own standalone "browse all people" directory,
 * duplicating /artists (the real, database-backed people directory and the
 * navigation label the product uses — see Header.tsx/Footer.tsx). It was
 * never wired into primary navigation (only reachable via a stale
 * command-palette entry), so old links land on /artists instead, the same
 * fix already applied to /creators for the identical reason.
 */
export default function PeopleRedirect() {
  redirect('/artists');
}
