import React from 'react';
import Link from 'next/link';
import styles from './Footer.module.css';

export const Footer: React.FC = () => {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.footerInner}>
        <div className={styles.topRow}>
          <div className={styles.brandCol}>
            <span className={styles.brandTitle}>OTAKUVA</span>
            <p className={styles.brandDesc}>Track what you watch.</p>
          </div>

          <nav className={styles.linksNav} aria-label="Footer Navigation">
            <div className={styles.linkGroup}>
              <span className={styles.groupHeading}>Navigation</span>
              <Link href="/anime" className={styles.footerLink}>Anime</Link>
              <Link href="/studios" className={styles.footerLink}>Studios</Link>
              <Link href="/production" className={styles.footerLink}>Production</Link>
              <Link href="/creators" className={styles.footerLink}>Creators</Link>
            </div>

            <div className={styles.linkGroup}>
              <span className={styles.groupHeading}>Discover</span>
              <Link href="/artists" className={styles.footerLink}>Artists</Link>
              <Link href="/news" className={styles.footerLink}>News</Link>
              <Link href="/community" className={styles.footerLink}>Community</Link>
            </div>

            <div className={styles.linkGroup}>
              <span className={styles.groupHeading}>Account</span>
              <Link href="/library" className={styles.footerLink}>Library</Link>
              <Link href="/profile" className={styles.footerLink}>Profile</Link>
              <Link href="/settings" className={styles.footerLink}>Settings</Link>
            </div>

            <div className={styles.linkGroup}>
              <span className={styles.groupHeading}>Legal</span>
              <Link href="/privacy" className={styles.footerLink}>Privacy</Link>
              <Link href="/terms" className={styles.footerLink}>Terms</Link>
              <Link href="/community-guidelines" className={styles.footerLink}>Community Guidelines</Link>
            </div>
          </nav>
        </div>

        <div className={styles.bottomRow}>
          <span>&copy; {new Date().getFullYear()} OTAKUVA. Built for anime discovery.</span>
          <span>Not a streaming platform.</span>
        </div>
      </div>
    </footer>
  );
};
