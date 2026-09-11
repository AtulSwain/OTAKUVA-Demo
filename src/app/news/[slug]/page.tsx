'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Bookmark,
  Share2,
  ExternalLink,
  Clock,
  Calendar,
  MessageSquare,
  Building2,
  Film,
  User,
  Check,
  Send,
  Sparkles,
  Shield,
  Layers,
  ChevronLeft,
  ChevronRight,
  Flame,
  Users,
  ArrowRight,
} from 'lucide-react';
import styles from './reader.module.css';

export default function NewsReaderPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [article, setArticle] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Comments state for user discussion
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');

  useEffect(() => {
    async function loadArticle() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/news/${slug}`);
        if (res.ok) {
          const data = await res.json();
          const loaded = data.article || data;
          setArticle(loaded);

          // Track article open event asynchronously
          if (loaded.id) {
            fetch('/api/news/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                eventType: 'NEWS_OPENED',
                articleId: loaded.id,
                metadata: { slug: loaded.slug, title: loaded.title },
              }),
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('Error fetching article:', err);
      } finally {
        setIsLoading(false);
      }
    }
    if (slug) loadArticle();
  }, [slug]);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);

      if (article?.id) {
        fetch('/api/news/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'NEWS_SHARED',
            articleId: article.id,
          }),
        }).catch(() => {});
      }
    }
  };

  const handleToggleSave = () => {
    setIsSaved(!isSaved);
  };

  const handleSourceClick = () => {
    if (article?.id) {
      fetch('/api/news/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'NEWS_SOURCE_OPENED',
          articleId: article.id,
          metadata: { sourceName: article.sourceName, url: article.canonicalUrl || article.sourceUrl },
        }),
      }).catch(() => {});
    }
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment = {
      id: `c_${Date.now()}`,
      author: 'Community Member',
      time: 'Just now',
      text: newCommentText.trim(),
    };

    setComments([newComment, ...comments]);
    setNewCommentText('');
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingHeader} />
        <div className={styles.loadingHero} />
        <div className={styles.loadingBody} />
      </div>
    );
  }

  if (!article) {
    return (
      <div className={styles.notFoundContainer}>
        <h2>Article Not Found</h2>
        <p>The requested news article could not be retrieved from the catalog.</p>
        <Link href="/news" className={styles.backLinkBtn}>
          <ArrowLeft size={14} aria-hidden="true" /> Return to News Platform
        </Link>
      </div>
    );
  }

  const publishFormatted = new Date(article.publishedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const displayTitle = article.displayTitle || article.title;
  const displaySummary = article.displaySummary || article.summary;
  const displayCategory = article.displayCategory || article.category;
  const targetUrl = article.canonicalUrl || article.sourceUrl || '#';

  return (
    <div className={styles.readerWrapper}>
      {/* 1. Top Reader Navigation Header */}
      <header className={styles.readerHeader}>
        <div className={styles.headerLeft}>
          <Link href="/news" className={styles.backBtn} aria-label="Back to News Platform">
            <ArrowLeft size={16} />
            <span>News Platform</span>
          </Link>
          <span className={styles.headerDivider}>/</span>
          <span className={styles.categoryBadge}>{displayCategory}</span>
          <span className={styles.sourceTag}>
            <Building2 size={12} />
            {article.sourceName}
          </span>
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={`${styles.actionIconBtn} ${isSaved ? styles.actionIconBtnActive : ''}`}
            onClick={handleToggleSave}
            title={isSaved ? 'Remove from Saved' : 'Save Article'}
          >
            <Bookmark size={14} fill={isSaved ? '#FFFFFF' : 'none'} />
            <span className={styles.btnLabel}>{isSaved ? 'Saved' : 'Save'}</span>
          </button>

          <button
            type="button"
            className={styles.actionIconBtn}
            onClick={handleShare}
            title="Copy link to story"
          >
            {copied ? <Check size={14} className={styles.checkIcon} /> : <Share2 size={14} />}
            <span className={styles.btnLabel}>{copied ? 'Copied' : 'Share'}</span>
          </button>
        </div>
      </header>

      {/* Transparency Banner */}
      <div className={styles.transparencyBanner}>
        <Shield size={13} className={styles.shieldIcon} />
        <span>
          You are viewing structured reporting on <strong>OTAKUVA</strong>. Original source attribution:{' '}
          <strong>{article.sourceName}</strong>.
        </span>
      </div>

      {/* 2. Full-Screen Editorial Hero */}
      <section className={styles.heroSection}>
        <div className={styles.heroMetaRow}>
          <span className={styles.heroCategory}>{displayCategory}</span>
          <span className={styles.metaDot}>•</span>
          <span className={styles.heroDate}>{publishFormatted}</span>
          {article.contentType && (
            <>
              <span className={styles.metaDot}>•</span>
              <span className={styles.contentTypeBadge}>
                {article.contentType === 'OTAKUVA_EDITORIAL'
                  ? 'Editorial'
                  : article.contentType === 'LICENSED_CONTENT'
                  ? 'Licensed'
                  : 'Source Metadata'}
              </span>
            </>
          )}
        </div>

        <h1 className={styles.heroTitle}>{displayTitle}</h1>

        {displaySummary && (
          <p className={styles.heroSubtitle}>{displaySummary}</p>
        )}

        <div className={styles.bylineRow}>
          <div className={styles.authorGroup}>
            <div className={styles.authorAvatar}>
              <User size={14} />
            </div>
            <span className={styles.authorName}>
              Reported by <strong>{article.author || article.sourceName}</strong>
            </span>
          </div>
          <span className={styles.bylineSource}>Source: {article.sourceName}</span>
        </div>

        {article.imageUrl && (
          <div className={styles.heroImageContainer}>
            <Image
              src={article.imageUrl}
              alt={displayTitle}
              fill
              priority
              className={styles.heroImg}
              unoptimized
            />
            <div className={styles.imageOverlayGradient} />
            <span className={styles.imageCaption}>
              Visual assets and production artwork courtesy of {article.sourceName}
            </span>
          </div>
        )}
      </section>

      {/* 3. Main Reading Content & Structured Knowledge Rails */}
      <div className={styles.contentLayout}>
        <main className={styles.articleMain}>
          {/* Key Information Highlights */}
          <div className={styles.keyHighlightsBox}>
            <div className={styles.highlightsHeader}>
              <Sparkles size={14} />
              <span>KEY DEVELOPMENTS</span>
            </div>
            <ul className={styles.highlightsList}>
              <li>
                <strong>Primary Focus:</strong> Official confirmation and production updates regarding {displayTitle}.
              </li>
              {article.relatedStudios && article.relatedStudios.length > 0 && (
                <li>
                  <strong>Animation Studio:</strong>{' '}
                  {article.relatedStudios.map((s: any) => s.name).join(', ')}.
                </li>
              )}
              {article.relatedAnime && article.relatedAnime.length > 0 && (
                <li>
                  <strong>Associated Franchise:</strong>{' '}
                  {article.relatedAnime.map((a: any) => a.canonicalTitle).join(', ')}.
                </li>
              )}
              <li>
                <strong>Coverage Scope:</strong> Industry release windows, key visuals, voice cast announcements, and production credits.
              </li>
            </ul>
          </div>

          {/* Editorial Summary / Content */}
          <div className={styles.proseContent}>
            <p className={styles.leadParagraph}>
              {displaySummary ||
                'The latest production milestone represents a major strategic focus for Japanese animation studios, continuing the expansion of canonical narrative arcs with key creative directors.'}
            </p>

            <p>
              Industry reporting from {article.sourceName} underscores the meticulous visual and musical composition invested in this project. With key animation supervisors and directors coordinating to preserve the distinctive atmosphere of the work, anticipation remains high across global fan communities.
            </p>

            <p>
              Production drafts and key visuals released alongside this announcement illustrate the character designs and expansive environmental backgrounds being rendered for broadcast and theatrical releases.
            </p>
          </div>

          {/* Canonical "Read Original Article" Action Card */}
          <div className={styles.readOriginalBanner}>
            <div className={styles.readOriginalInfo}>
              <h3 className={styles.readOriginalTitle}>Read Full Original Coverage</h3>
              <p className={styles.readOriginalDesc}>
                Source: <strong>{article.sourceName}</strong> • Published: <strong>{publishFormatted}</strong>
              </p>
              <p className={styles.readOriginalDesc}>
                View complete uninterrupted text, interviews, and official media directly on the original publisher website.
              </p>
            </div>
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.readOriginalActionBtn}
              onClick={handleSourceClick}
            >
              <span>READ ORIGINAL ARTICLE</span>
              <ExternalLink size={13} />
            </a>
          </div>

          {/* Syndicated Coverage (if clustered) */}
          {article.syndicatedReports && article.syndicatedReports.length > 0 && (
            <div className={styles.syndicatedBox}>
              <div className={styles.syndicatedHeader}>
                <Layers size={14} />
                <span>MORE COVERAGE ON THIS STORY</span>
              </div>
              <div className={styles.syndicatedList}>
                {article.syndicatedReports.map((rep: any) => (
                  <Link key={rep.id} href={`/news/${rep.slug || rep.id}`} className={styles.syndicatedItem}>
                    <span className={styles.syndicatedSource}>{rep.sourceName}</span>
                    <span className={styles.syndicatedTitle}>{rep.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Integrated Community Discussions */}
          <section className={styles.discussionSection}>
            <div className={styles.discussionHeader}>
              <div className={styles.discussionTitleWrap}>
                <MessageSquare size={16} />
                <h3>Community Discussion</h3>
              </div>
              <span className={styles.commentCountBadge}>{comments.length} Comments</span>
            </div>

            {/* Comment Post Form */}
            <form onSubmit={handlePostComment} className={styles.commentForm}>
              <textarea
                placeholder="Share your thoughts on this announcement..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                rows={3}
                className={styles.commentInput}
              />
              <div className={styles.commentFormFooter}>
                <span className={styles.spoilerHint}>Be respectful &amp; spoiler-safe</span>
                <button type="submit" className={styles.postCommentBtn} disabled={!newCommentText.trim()}>
                  <Send size={12} />
                  <span>Post Comment</span>
                </button>
              </div>
            </form>

            {/* Comment Threads */}
            <div className={styles.commentsList}>
              {comments.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>
                  No comments yet. Start the discussion on this industry news!
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className={styles.commentCard}>
                    <div className={styles.commentHeader}>
                      <div className={styles.commentAuthorWrap}>
                        <span className={styles.commentAuthorName}>@{c.author}</span>
                      </div>
                      <span className={styles.commentTime}>{c.time}</span>
                    </div>
                    <p className={styles.commentText}>{c.text}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>

        {/* 4. Connected Knowledge Rails & Entities */}
        <aside className={styles.entitiesSidebar}>
          {/* Related Anime Entity */}
          {article.relatedAnime && article.relatedAnime.length > 0 && (
            <div className={styles.sidebarCard}>
              <div className={styles.sidebarHeader}>
                <Film size={14} />
                <h4>Related Anime</h4>
              </div>
              <div className={styles.entityItems}>
                {article.relatedAnime.map((anime: any) => (
                  <Link key={anime.id} href={`/anime/${anime.slug || anime.id}`} className={styles.entityItem}>
                    {anime.posterUrl && (
                      <div className={styles.entityPosterWrap}>
                        <Image src={anime.posterUrl} alt={anime.canonicalTitle} fill className={styles.entityPoster} unoptimized />
                      </div>
                    )}
                    <div className={styles.entityMeta}>
                      <span className={styles.entityTitle}>{anime.canonicalTitle}</span>
                      <span className={styles.entitySubtitle}>View Catalog Page <ArrowRight size={13} aria-hidden="true" /></span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related Studio Entity */}
          {article.relatedStudios && article.relatedStudios.length > 0 && (
            <div className={styles.sidebarCard}>
              <div className={styles.sidebarHeader}>
                <Building2 size={14} />
                <h4>Animation Studio</h4>
              </div>
              <div className={styles.entityItems}>
                {article.relatedStudios.map((studio: any) => (
                  <Link key={studio.id} href={`/studio/${studio.slug}`} className={styles.entityItem}>
                    <div className={styles.entityMeta}>
                      <span className={styles.entityTitle}>{studio.name}</span>
                      <span className={styles.entitySubtitle}>Explore Studio Portfolio <ArrowRight size={13} aria-hidden="true" /></span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related People */}
          {article.relatedPeople && article.relatedPeople.length > 0 && (
            <div className={styles.sidebarCard}>
              <div className={styles.sidebarHeader}>
                <User size={14} />
                <h4>Credited Staff &amp; Cast</h4>
              </div>
              <div className={styles.entityItems}>
                {article.relatedPeople.map((person: any) => (
                  <div key={person.id} className={styles.personItem}>
                    <span className={styles.entityTitle}>{person.name}</span>
                    {person.nameKanji && <span className={styles.kanjiTag}>{person.nameKanji}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Community Hub Connection */}
          {article.relatedAnime && article.relatedAnime.length > 0 && (
            <div className={styles.sidebarCard}>
              <div className={styles.sidebarHeader}>
                <Users size={14} />
                <h4>Community Hub</h4>
              </div>
              <p className={styles.communityPromoText}>
                Discuss this anime in dedicated fan communities and real-time chat rooms.
              </p>
              <Link href={`/anime/${article.relatedAnime[0].slug || article.relatedAnime[0].id}`} className={styles.communityJoinBtn}>
                Join Community Discussions
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
