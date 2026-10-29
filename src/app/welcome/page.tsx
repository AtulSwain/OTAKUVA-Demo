import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthUserFromCookies } from '../../lib/auth';
import { getLandingPosters } from '../../lib/landing/landingPosters';
import { WelcomeClient } from './WelcomeClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'OTAKUVA — Track, rate and talk anime',
  description: 'Track what you watch, rate every episode and talk anime with people who love it.',
};

/**
 * Landing page (2026-10-28, owner): what signed-out visitors see first.
 * Real catalog posters drift behind a centred sign-in card; signing in goes
 * to the homepage. Signed-in visitors skip it.
 */
export default async function WelcomePage() {
  const user = await getAuthUserFromCookies();
  if (user) redirect('/');
  const posters = await getLandingPosters(120).catch(() => []);
  return <WelcomeClient posters={posters} />;
}
