import { Metadata } from 'next';
import styles from './credits.module.css';

export const metadata: Metadata = {
  title: 'Data Credits — OTAKUVA',
};

export default function CreditsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Data Credits</h1>
        <p className={styles.subtitle}>
          OTAKUVA is a knowledge and tracking layer, not the original source of the anime,
          character, staff, and studio information it shows. That catalog data comes from the
          providers below.
        </p>
      </div>

      <div className={styles.sources}>
        <div className={styles.sourceCard}>
          <h2 className={styles.sourceName}>
            <a href="https://myanimelist.net" target="_blank" rel="noopener noreferrer">
              MyAnimeList
            </a>{' '}
            (via Jikan)
          </h2>
          <p className={styles.sourceDesc}>
            Anime metadata, episodes, characters, staff, and scores are sourced from
            MyAnimeList.net through{' '}
            <a href="https://jikan.moe" target="_blank" rel="noopener noreferrer">
              Jikan
            </a>
            , an unofficial MyAnimeList API. OTAKUVA is not affiliated with, endorsed by, or
            sponsored by MyAnimeList.net.
          </p>
        </div>

        <div className={styles.sourceCard}>
          <h2 className={styles.sourceName}>
            <a href="https://anilist.co" target="_blank" rel="noopener noreferrer">
              AniList
            </a>
          </h2>
          <p className={styles.sourceDesc}>
            Anime metadata, airing schedules, and relations are also sourced from the AniList
            API. OTAKUVA is not affiliated with, endorsed by, or sponsored by AniList.
          </p>
        </div>
      </div>

      <p className={styles.disclaimer}>
        Catalog data is synced periodically and may be incomplete, delayed, or occasionally
        incorrect relative to the source — see each anime’s page for what OTAKUVA currently
        has on record. Community-submitted content (ratings, reviews, discussions) is OTAKUVA’s
        own and is not sourced from either provider above.
      </p>
    </div>
  );
}
