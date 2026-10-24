import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CalendarRange, Clapperboard, Disc3, Globe, Sparkles, Tv, type LucideIcon } from 'lucide-react';
import { getBrowseDirectory, type DirectoryTile } from '../../lib/browseDirectory';
import styles from './browse.module.css';
import { PageHead } from '../../components/ui/PageHead';
import { CatalogSearchBox } from '../../components/anime/CatalogSearchBox';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Browse',
  description: 'Browse anime by genre, format, season, decade and theme.',
};

const FORMAT_ICONS: Record<string, LucideIcon> = {
  TV: Tv,
  Movie: Clapperboard,
  OVA: Disc3,
  ONA: Globe,
  Special: Sparkles,
};

const titles = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'title' : 'titles'}`;

type SearchParams = Record<string, string | string[] | undefined>;

/** Old Browse links: ?tab= lists moved to Top Picks (2026-10-18); ?genre= opens the catalog. */
function legacyTarget(sp: SearchParams): string | null {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') qs.set(k, v);
  }
  if (qs.has('tab')) return `/top-picks?${qs}`;
  const genre = qs.get('genre');
  if (genre) return `/anime?genre=${encodeURIComponent(genre)}`;
  return null;
}

/**
 * Browse — a directory of ways into the catalog. Every tile shows a real
 * count and opens the matching filtered page. The ranked lists (Top 100,
 * Hidden Gems…) live on Top Picks; free search lives on Explore (/anime).
 */
export default async function BrowsePage({ searchParams }: { searchParams: SearchParams }) {
  const legacy = legacyTarget(searchParams);
  if (legacy) redirect(legacy);

  const dir = await getBrowseDirectory();

  return (
    <div className={styles.page}>
      <PageHead kicker="By category" title="Browse">
        Find anime by genre, format, season, decade or theme. Looking for the best of the best? See{' '}
        <Link href="/top-picks">Top Picks</Link>.
      </PageHead>

      <div className={styles.search}>
        <CatalogSearchBox />
      </div>

      <nav className={styles.jump} aria-label="Jump to section">
        <a href="#genres">Genres</a>
        <a href="#formats">Formats</a>
        <a href="#seasons">Seasons</a>
        <a href="#decades">Decades</a>
        {dir.themes.length > 0 && <a href="#themes">Themes</a>}
      </nav>

      <section id="genres" className={styles.section} aria-labelledby="genres-title">
        <h2 id="genres-title">Genres</h2>
        <div className={styles.genreGrid}>
          {dir.genres.map((g) => {
            const hue = [...g.genre].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
            return (
              <Link
                key={g.genre}
                href={`/anime?genre=${encodeURIComponent(g.genre)}`}
                className={styles.genreTile}
                style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 30%), hsl(${(hue + 40) % 360} 60% 16%))` }}
              >
                {g.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.imageUrl} alt="" loading="lazy" decoding="async" className={styles.genreImg} />
                )}
                <span className={styles.genreShade} aria-hidden="true" />
                <span className={styles.genreText}>
                  <strong>{g.genre}</strong>
                  <span>{titles(g.count)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="formats" className={styles.section} aria-labelledby="formats-title">
        <h2 id="formats-title">Formats</h2>
        <div className={styles.tileGrid}>
          {dir.formats.map((f) => {
            const Icon = FORMAT_ICONS[f.key];
            return (
              <Link key={f.key} href={f.href} className={styles.tile}>
                <span className={styles.tileIcon} aria-hidden="true">{Icon && <Icon size={22} />}</span>
                <span className={styles.tileText}>
                  <strong>{f.label}</strong>
                  <span>{f.hint} · {titles(f.count)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="seasons" className={styles.section} aria-labelledby="seasons-title">
        <h2 id="seasons-title">Seasons</h2>
        <div className={styles.tileGrid}>
          {dir.seasons.map((s) => (
            <Link key={s.key} href={s.href} className={styles.tile}>
              <span className={styles.tileIcon} aria-hidden="true"><CalendarRange size={22} /></span>
              <span className={styles.tileText}>
                <strong>{s.label}</strong>
                <span>{s.hint} · {titles(s.count)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section id="decades" className={styles.section} aria-labelledby="decades-title">
        <h2 id="decades-title">Decades</h2>
        <div className={styles.decadeGrid}>
          {dir.decades.map((d) => (
            <Link key={d.key} href={d.href} className={styles.decade}>
              <strong>{d.label}</strong>
              <span>{titles(d.count)}</span>
            </Link>
          ))}
        </div>
      </section>

      {dir.themes.length > 0 && (
        <section id="themes" className={styles.section} aria-labelledby="themes-title">
          <h2 id="themes-title">Themes</h2>
          <div className={styles.chips}>
            {dir.themes.map((t: DirectoryTile) => (
              <Link key={t.key} href={t.href} className={styles.chip}>
                {t.label} <span>{t.count.toLocaleString()}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
