import React from 'react';
import Link from 'next/link';
import styles from './Newsroom.module.css';

interface NewsItem { id: string; slug: string; title: string; category: string; date: string; }

export const Newsroom: React.FC<{ articles: NewsItem[] }> = ({ articles }) => (
  <section className={styles.section} aria-label="Newsroom">
    <div className={styles.sectionHead}><h2>Newsroom</h2><Link href="/news">View all news →</Link></div>
    <div className={styles.list}>
      {articles.slice(0, 5).map((article) => (
        <Link key={article.id} href={`/news/${article.slug || article.id}`} className={styles.row}>
          <div><span>{article.category || 'INDUSTRY'}</span><strong>{article.title}</strong></div>
          <time dateTime={article.date}>{new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round((new Date(article.date).getTime() - Date.now()) / 86400000), 'day')}</time>
        </Link>
      ))}
    </div>
  </section>
);
