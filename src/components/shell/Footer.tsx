import React from 'react';
import Link from 'next/link';
import styles from './Footer.module.css';

const GROUPS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Explore',
    links: [
      { href: '/anime', label: 'Anime' },
      { href: '/top-picks', label: 'Top Picks' },
      { href: '/browse', label: 'Browse' },
      { href: '/schedule', label: 'Schedule' },
      { href: '/seasonal', label: 'Seasonal' },
      { href: '/rankings', label: 'Rankings' },
    ],
  },
  {
    heading: 'Community',
    links: [
      { href: '/community', label: 'Communities' },
      { href: '/discussions', label: 'Discussions' },
      { href: '/articles', label: 'Articles' },
      { href: '/news', label: 'News' },
    ],
  },
  {
    heading: 'Studios & people',
    links: [
      { href: '/studios', label: 'Studios' },
      { href: '/artists', label: 'Creators' },
      { href: '/production', label: 'Production' },
      { href: '/collections', label: 'Collections' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { href: '/library', label: 'Library' },
      { href: '/profile/you', label: 'Profile' },
      { href: '/activity', label: 'Activity' },
      { href: '/settings', label: 'Settings' },
    ],
  },
];

const LEGAL = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/community-guidelines', label: 'Community Guidelines' },
  { href: '/report-content', label: 'Report content' },
  { href: '/credits', label: 'Data credits' },
];

export const Footer: React.FC = () => {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.footerInner}>
        <div className={styles.topRow}>
          <div className={styles.brandCol}>
            <span className={styles.brandTitle}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/otakuva-mark.png" alt="" width={40} height={31} className={styles.brandMark} />
              OTAKUVA
            </span>
            <p className={styles.brandDesc}>Track what you watch, rate what you love, and find what&apos;s next.</p>
            <p className={styles.brandNote}>
              Not a streaming platform. Anime data from AniList and MyAnimeList (via Jikan) — see{' '}
              <Link href="/credits">data credits</Link>.
            </p>
          </div>

          <nav className={styles.linksNav} aria-label="Footer">
            {GROUPS.map((group) => (
              <div key={group.heading} className={styles.linkGroup}>
                <span className={styles.groupHeading}>{group.heading}</span>
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href} className={styles.footerLink}>
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className={styles.bottomRow}>
          <span>&copy; {new Date().getFullYear()} OTAKUVA</span>
          <nav className={styles.legalNav} aria-label="Legal">
            {LEGAL.map((link) => (
              <Link key={link.href} href={link.href} className={styles.legalLink}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
};
