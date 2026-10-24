import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Award, CalendarDays, Clapperboard, Flame, Gem, Popcorn, Star, Trophy, type LucideIcon } from 'lucide-react';
import { RankedRow } from '../../components/browse/RankedRow';
import { getBrowseList } from '../../lib/browseService';
import {
  BROWSE_COUNTRIES,
  BROWSE_FORMATS,
  BROWSE_GENRES,
  BROWSE_TABS,
  TOP_PICKS_DEFAULT_TAB,
  TOP_PICKS_PATH,
  browseHref,
  parseBrowseParams,
  type BrowseTabId,
} from '../../lib/browse';
import styles from './topPicks.module.css';
import { PageHead } from '../../components/ui/PageHead';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Top Picks',
  description: 'Top 100 anime of all time, binge-worthy series, hidden gems, best movies, award winners and more.',
};

// One icon per category. OTAKUVA Choice uses the logo mark instead.
const CATEGORY_ICONS: Partial<Record<BrowseTabId, LucideIcon>> = {
  top100: Trophy,
  binge: Popcorn,
  viewed: Flame,
  gems: Gem,
  movies: Clapperboard,
  awards: Award,
  rated: Star,
  monthly: CalendarDays,
};

/**
 * Top Picks — the ranked, curated lists (Top 100, Hidden Gems…). Opens on
 * Top 100. Browse (/browse) is the category directory; Explore (/anime) is search.
 */
export default async function TopPicksPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const state = parseBrowseParams(searchParams, TOP_PICKS_DEFAULT_TAB);
  const { tab, ...filters } = state;
  const items = await getBrowseList(tab, filters);
  const active = BROWSE_TABS.find((t) => t.id === tab)!;
  const anyFilter = Boolean(state.genre || state.format || state.country || state.family);
  const List = tab === 'awards' ? 'ul' : 'ol';

  return (
    <div className={styles.page}>
      <PageHead kicker="The best" title="Top Picks">
        The 100 best anime of all time, binge-worthy series, hidden gems, best movies, award winners and OTAKUVA&apos;s own choices.
      </PageHead>

      <nav className={styles.categories} aria-label="Top Picks categories">
        {BROWSE_TABS.map((t) => {
          const Icon = CATEGORY_ICONS[t.id];
          const isActive = t.id === tab;
          return (
            <Link
              key={t.id}
              href={browseHref(state, { tab: t.id })}
              className={`${styles.category} ${isActive ? styles.categoryActive : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.categoryIcon} aria-hidden="true">
                {Icon ? (
                  <Icon size={22} strokeWidth={2} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/brand/otakuva-mark.png" alt="" width={30} height={23} />
                )}
              </span>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>

      <nav className={styles.chips} aria-label="Genres">
        <Link href={browseHref(state, { genre: undefined })} className={`${styles.chip} ${!state.genre ? styles.chipActive : ''}`} aria-current={!state.genre ? 'true' : undefined}>
          All genres
        </Link>
        {BROWSE_GENRES.map((g) => (
          <Link key={g} href={browseHref(state, { genre: g })} className={`${styles.chip} ${state.genre === g ? styles.chipActive : ''}`} aria-current={state.genre === g ? 'true' : undefined}>
            {g}
          </Link>
        ))}
      </nav>

      <form method="get" action={TOP_PICKS_PATH} className={styles.filters}>
        <input type="hidden" name="tab" value={tab} />
        {state.genre && <input type="hidden" name="genre" value={state.genre} />}
        <label className={styles.field}>
          <span>Category</span>
          <select name="format" defaultValue={state.format ?? ''}>
            <option value="">All categories</option>
            {BROWSE_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>Country</span>
          <select name="country" defaultValue={state.country ?? ''}>
            <option value="">All countries</option>
            {BROWSE_COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className={styles.check}>
          <input type="checkbox" name="family" value="1" defaultChecked={state.family} />
          <span>Family-friendly</span>
        </label>
        <button type="submit" className={styles.apply}>Apply</button>
        {anyFilter && <Link href={browseHref({ tab })} className={styles.clear}>Clear all</Link>}
      </form>

      <section aria-labelledby="list-title" className={styles.listSection}>
        <h2 id="list-title">{active.label}{state.genre ? `: ${state.genre}` : ''}</h2>
        <p className={styles.blurb}>{active.blurb}</p>
        {items.length > 0 && <p className={styles.blurb}>{items.length} {items.length === 1 ? 'title' : 'titles'}</p>}
        {state.family && (
          <p className={styles.blurb}>Family-friendly hides titles with Ecchi, Horror, Gore or Nudity tags. There is no official age rating.</p>
        )}

        {items.length > 0 ? (
          <List className={styles.list}>
            {items.map((item) => <RankedRow key={item.id} item={item} />)}
          </List>
        ) : (
          <p className={styles.empty}>
            No titles match these filters. <Link href={browseHref({ tab })}>Clear filters</Link>
          </p>
        )}
        <p className={styles.credit}>Titles and images from AniList and MyAnimeList via the OTAKUVA catalog.</p>
      </section>
    </div>
  );
}
