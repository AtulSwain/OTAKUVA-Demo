import React from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import styles from './Footer.module.css';

// Footer (2026-11-03, owner): the "Need a Hand?" support box moved to
// /support and /about; the footer is now a classic site footer — brand, then
// Company / Help / Legal link columns, "Made in India", copyright.
// Privacy and Data credits must stay linked: AniList's terms ask for the
// data credit, and app stores / SMS providers need a privacy policy.
const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About Us' },
      { href: '/support', label: 'Support' },
      { href: '/articles', label: 'Member articles' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { href: '/support', label: 'Help centre' },
      { href: '/forgot-password', label: 'Forgot password or username' },
      { href: '/report-content', label: 'Report content' },
      { href: '/community-guidelines', label: 'Community guidelines' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/terms', label: 'Terms & Conditions' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/credits', label: 'Data credits' },
    ],
  },
];

const LEGAL = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/support', label: 'Support' },
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
              Not a streaming platform. Anime data from AniList and MyAnimeList (via Jikan) — see <Link href="/credits">data credits</Link>.
            </p>
          </div>

          <nav className={styles.linksNav} aria-label="Footer">
            {COLUMNS.map((col) => (
              <div key={col.heading} className={styles.linkGroup}>
                <h2 className={styles.groupHeading}>{col.heading}</h2>
                {col.links.map((link) => (
                  <Link key={link.label} href={link.href} className={styles.footerLink}>
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className={styles.madeIn}>
          <span className={styles.madeInKicker}>Made in India</span>
          <span className={styles.madeWith}>
            Made with <Heart size={13} fill="currentColor" aria-label="love" className={styles.heart} /> from India
          </span>
        </div>

        <div className={styles.bottomRow}>
          <span>&copy; {new Date().getFullYear()} Copyright OTAKUVA. All rights reserved.</span>
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
