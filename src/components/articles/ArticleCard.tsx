import React from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { UserAvatar } from '../ui/UserAvatar';
import styles from './ArticleCard.module.css';
import { resolveMediaUrl } from '../../lib/mediaResolver';

export interface ArticleCardData {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverImageUrl: string | null;
  createdAt: string;
  readMinutes: number;
  author: { username: string; avatarUrl: string | null };
  anime: { slug: string; title: string; posterUrl: string | null } | null;
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Member article tile: cover (or a typographic fallback), title, summary, who shared it. */
export function ArticleCard({ article, hideAuthor = false }: { article: ArticleCardData; hideAuthor?: boolean }) {
  const cover = resolveMediaUrl(article.coverImageUrl) || article.anime?.posterUrl || null;
  return (
    <Link href={`/articles/${article.slug}`} className={styles.card}>
      <div className={`${styles.cover} ${cover ? '' : styles.coverEmpty}`}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" loading="lazy" decoding="async" className={styles.coverImg} />
        ) : (
          <FileText size={28} aria-hidden="true" />
        )}
        {article.anime && <span className={styles.animeTag}>{article.anime.title}</span>}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{article.title}</h3>
        <p className={styles.summary}>{article.summary}</p>
        <div className={styles.meta}>
          {!hideAuthor && (
            <span className={styles.author}>
              <UserAvatar username={article.author.username} avatarUrl={article.author.avatarUrl} size={22} />
              <span>@{article.author.username}</span>
            </span>
          )}
          <span>{DATE_FORMAT.format(new Date(article.createdAt))}</span>
          <span>{article.readMinutes} min read</span>
        </div>
      </div>
    </Link>
  );
}
