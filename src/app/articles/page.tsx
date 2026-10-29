import Link from 'next/link';
import { PenLine } from 'lucide-react';
import { listArticles } from '../../lib/articles/articleService';
import { ArticleCard } from '../../components/articles/ArticleCard';
import styles from './articles.module.css';
import { CommunityHubNav } from '../../components/community/CommunityHubNav';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Articles — OTAKUVA',
  description: 'News tips, write-ups and information about anime, shared by OTAKUVA members.',
};

/**
 * Member articles. Separate from /news (provider-ingested editorial news):
 * everything here was written and shared by a member, and says who.
 */
export default async function ArticlesPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { articles, total, hasMore } = await listArticles({ page, limit: 18 }).catch(() => ({ articles: [], total: 0, hasMore: false }));

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      <CommunityHubNav />
      <header className={styles.hero}>
        <p className={styles.kicker}>From the community</p>
        <h1 className={styles.title}>Articles</h1>
        <Link href="/articles/new" className={styles.writeBtn}>
          <PenLine size={15} aria-hidden="true" /> Write an article
        </Link>
      </header>

      {articles.length > 0 ? (
        <>
          <p className={styles.count}>
            {total.toLocaleString('en-US')} {total === 1 ? 'article' : 'articles'}
          </p>
          <div className={styles.grid}>
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
          {(page > 1 || hasMore) && (
            <nav className={styles.pager} aria-label="Pages">
              {page > 1 && (
                <Link href={`/articles?page=${page - 1}`} className={styles.pagerBtn}>
                  Newer
                </Link>
              )}
              {hasMore && (
                <Link href={`/articles?page=${page + 1}`} className={styles.pagerBtn}>
                  Older
                </Link>
              )}
            </nav>
          )}
        </>
      ) : (
        <div className={styles.empty}>
          <h2>No articles yet</h2>
          <p>Heard some anime news or found something worth sharing? Be the first to write it up.</p>
          <Link href="/articles/new" className={styles.writeBtn}>
            <PenLine size={15} aria-hidden="true" /> Write the first article
          </Link>
        </div>
      )}
    </div>
  );
}
