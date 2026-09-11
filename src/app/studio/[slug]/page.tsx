'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Building2,
  Globe,
  Star,
  Film,
  Calendar,
  MapPin,
  Users,
  Sparkles,
  History,
  TrendingUp,
  ExternalLink,
  ChevronRight,
  Bookmark,
  Check,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { AnimeCard } from '../../../components/ui/AnimeCard';
import { AnimeGrid } from '../../../components/ui/AnimeGrid';
import styles from './studio.module.css';

type StudioTab = 'projects' | 'history' | 'founders' | 'analytics' | 'communities' | 'dna' | 'news';

export default function StudioDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [studio, setStudio] = useState<any>(null);
  const [studioNews, setStudioNews] = useState<any[]>([]);
  const [newsCategory, setNewsCategory] = useState<string>('ALL');
  const [historyEvents, setHistoryEvents] = useState<any[]>([]);
  const [historyEras, setHistoryEras] = useState<any[]>([]);
  const [upcomingProjects, setUpcomingProjects] = useState<any[]>([]);
  const [studioAnalytics, setStudioAnalytics] = useState<any>(null);
  const [studioDashboard, setStudioDashboard] = useState<any>(null);
  const [studioCommunities, setStudioCommunities] = useState<any[]>([]);
  const [personalization, setPersonalization] = useState<any>(null);
  const [relatedStudios, setRelatedStudios] = useState<any[]>([]);
  const [historyMajorOnly, setHistoryMajorOnly] = useState(false);
  const [selectedEraId, setSelectedEraId] = useState<string>('ALL');
  const [selectedHistoryType, setSelectedHistoryType] = useState<string>('ALL');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StudioTab>('projects');
  const [formatFilter, setFormatFilter] = useState('All');
  const [sortBy, setSortBy] = useState('score');
  const [isFollowing, setIsFollowing] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<string>('ALL_TIME');
  const [advancedAnalytics, setAdvancedAnalytics] = useState<any>(null);

  useEffect(() => {
    async function loadStudioData() {
      try {
        setLoading(true);
        const [
          studioRes,
          dashboardRes,
          newsRes,
          historyRes,
          upcomingRes,
          analyticsRes,
          advancedAnalyticsRes,
          communitiesRes,
          personalizationRes,
          relatedRes,
        ] = await Promise.allSettled([
          fetch(`/api/studios/${slug}?format=${formatFilter}&sortBy=${sortBy}`),
          fetch(`/api/studios/${slug}/dashboard`),
          fetch(`/api/studios/${slug}/news?category=${newsCategory}`),
          fetch(`/api/studios/${slug}/history`),
          fetch(`/api/studios/${slug}/upcoming`),
          fetch(`/api/studios/${slug}/analytics`),
          fetch(`/api/studios/${slug}/advanced-analytics?period=${analyticsPeriod}`),
          fetch(`/api/studios/${slug}/communities`),
          fetch(`/api/studios/${slug}/personalization`),
          fetch(`/api/studios/${slug}/related`),
        ]);

        if (studioRes.status === 'fulfilled' && studioRes.value.ok) {
          const data = await studioRes.value.json();
          setStudio(data.studio);
        }

        if (dashboardRes.status === 'fulfilled' && dashboardRes.value.ok) {
          const data = await dashboardRes.value.json();
          setStudioDashboard(data.dashboard);
        }

        if (newsRes.status === 'fulfilled' && newsRes.value.ok) {
          const data = await newsRes.value.json();
          setStudioNews(data.articles || []);
        }

        if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
          const data = await historyRes.value.json();
          setHistoryEvents(data.events || []);
          setHistoryEras(data.eras || []);
        }

        if (upcomingRes.status === 'fulfilled' && upcomingRes.value.ok) {
          const data = await upcomingRes.value.json();
          setUpcomingProjects(data.upcoming || []);
        }

        if (analyticsRes.status === 'fulfilled' && analyticsRes.value.ok) {
          const data = await analyticsRes.value.json();
          setStudioAnalytics(data);
        }

        if (advancedAnalyticsRes.status === 'fulfilled' && advancedAnalyticsRes.value.ok) {
          const data = await advancedAnalyticsRes.value.json();
          setAdvancedAnalytics(data);
        }

        if (communitiesRes.status === 'fulfilled' && communitiesRes.value.ok) {
          const data = await communitiesRes.value.json();
          setStudioCommunities(data.communities || []);
        }

        if (personalizationRes.status === 'fulfilled' && personalizationRes.value.ok) {
          const data = await personalizationRes.value.json();
          setPersonalization(data.personalization || null);
        }

        if (relatedRes.status === 'fulfilled' && relatedRes.value.ok) {
          const data = await relatedRes.value.json();
          setRelatedStudios(data.related || []);
        }
      } catch (e) {
        console.error('Error loading studio:', e);
      } finally {
        setLoading(false);
      }
    }

    if (slug) loadStudioData();
  }, [slug, formatFilter, sortBy, newsCategory, analyticsPeriod]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSkeletonHeader} />
        <div className={styles.loadingSkeletonBody} />
      </div>
    );
  }

  if (!studio) {
    return (
      <div className={styles.container}>
        <div className={styles.notFoundCard}>
          <h2>Studio Not Found</h2>
          <p>The requested animation studio could not be retrieved from the catalog.</p>
          <Link href="/studios" className={styles.backBtn}>
            <ArrowLeft size={14} aria-hidden="true" /> Return to Studios Directory
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: StudioTab; label: string; count?: number }[] = [
    { id: 'projects', label: 'PROJECTS', count: studio.animes?.length || studio.totalWorks },
    { id: 'history', label: 'HISTORY & TIMELINE' },
    { id: 'founders', label: 'PEOPLE & STAFF', count: studio.founders?.length || studio.staff?.length },
    { id: 'analytics', label: 'ANALYTICS & STATS' },
    { id: 'communities', label: 'COMMUNITIES', count: studioCommunities.length },
    { id: 'dna', label: 'STUDIO DNA' },
    { id: 'news', label: 'STUDIO NEWS', count: studioNews.length },
  ];

  return (
    <div className={styles.container}>
      {/* 1. STUDIO HERO BANNER */}
      <header className={styles.heroSection}>
        <div className={styles.heroMain}>
          <div className={styles.logoBox}>
            {studio.imageUrl ? (
              <Image
                src={studio.imageUrl}
                alt={studio.name}
                width={72}
                height={72}
                className={styles.logoImg}
                unoptimized
              />
            ) : (
              <Building2 size={36} className={styles.defaultLogoIcon} />
            )}
          </div>

          <div className={styles.heroInfo}>
            <div className={styles.badgeRow}>
              <span className={styles.categoryPill}>ANIMATION STUDIO</span>
              {studio.nativeName && <span className={styles.nativeName}>{studio.nativeName}</span>}
              {studio.verificationStatus === 'VERIFIED' && (
                <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                  <Check size={12} aria-hidden="true" /> VERIFIED DATA
                </span>
              )}
            </div>

            <h1 className={styles.studioTitle}>{studio.name}</h1>

            <div className={styles.metaRow}>
              <span className={styles.metaItem}>
                <Calendar size={13} />
                <span>{studio.foundedDate} ({studio.foundedYear})</span>
              </span>
              <span className={styles.metaDot}>•</span>
              <span className={styles.metaItem}>
                <MapPin size={13} />
                <span>{studio.location}, {studio.country}</span>
              </span>
              {studio.website && (
                <>
                  <span className={styles.metaDot}>•</span>
                  <a
                    href={studio.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.websiteLink}
                  >
                    <Globe size={13} />
                    <span>Official Website</span>
                    <ExternalLink size={11} />
                  </a>
                </>
              )}
            </div>
          </div>

          <div className={styles.heroActions}>
            <button
              type="button"
              className={`${styles.followBtn} ${isFollowing ? styles.followBtnActive : ''}`}
              onClick={() => setIsFollowing(!isFollowing)}
            >
              {isFollowing ? <Check size={14} /> : <Bookmark size={14} />}
              <span>{isFollowing ? 'Following' : 'Follow Studio'}</span>
            </button>
          </div>
        </div>

        {/* Quick Highlights Metrics */}
        <div className={styles.quickStatsGrid}>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>Total Productions</span>
            <span className={styles.statValue}>{studio.totalWorks} Works</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>Average Community Score</span>
            <span className={styles.statValue}>{studio.stats?.averageScore ? <><Star size={12} fill="currentColor" aria-hidden="true" /> {studio.stats.averageScore}</> : '—'}</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>TV Series</span>
            <span className={styles.statValue}>{studio.stats?.tvCount || 0}</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>Theatrical Movies</span>
            <span className={styles.statValue}>{studio.stats?.movieCount || 0}</span>
          </div>
        </div>

        {/* Personalized User Studio Context Banner (if authenticated) */}
        {personalization && personalization.watchedCount > 0 && (
          <div style={{ marginTop: '16px', padding: '14px 18px', background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.15) 0%, rgba(20, 22, 28, 0.9) 100%)', border: '1px solid rgba(139, 92, 246, 0.35)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={18} color="#c4b5fd" />
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Your Studio Affinity</span>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#cbd5e1' }}>
                  You have completed <strong>{personalization.watchedCount}</strong> productions from {studio.name} ({personalization.userAffinity.percentageScore}% Taste Affinity)
                </p>
              </div>
            </div>
            {personalization.unwatchedRecommendations?.length > 0 && (
              <Link
                href={`/anime/${personalization.unwatchedRecommendations[0].slug}`}
                style={{ fontSize: '12px', color: '#c4b5fd', textDecoration: 'none', background: 'rgba(139,92,246,0.2)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(139,92,246,0.3)', fontWeight: 600 }}
              >
                Recommended Next: {personalization.unwatchedRecommendations[0].canonicalTitle} <ArrowRight size={13} aria-hidden="true" />
              </Link>
            )}
          </div>
        )}
      </header>

      {/* 2. TAB CONTROLS */}
      <nav className={styles.tabNav} role="tablist" aria-label="Studio Details Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && <span className={styles.tabCount}>({tab.count})</span>}
          </button>
        ))}
      </nav>

      {/* 3. TAB CONTENT */}
      <main className={styles.tabBody}>
        {/* TAB 1: PROJECTS & CATALOG */}
        {activeTab === 'projects' && (
          <section className={styles.projectsSection}>
            <div className={styles.filterControlsBar}>
              <div className={styles.formatFilters}>
                {['All', 'TV', 'Movie', 'OVA', 'ONA'].map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    className={`${styles.formatPill} ${formatFilter === fmt ? styles.formatPillActive : ''}`}
                    onClick={() => setFormatFilter(fmt)}
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              <div className={styles.sortControls}>
                <span className={styles.sortLabel}>Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className={styles.sortSelect}
                >
                  <option value="score">Highest Rated</option>
                  <option value="year">Release Year (Newest)</option>
                  <option value="title">Title (A-Z)</option>
                  <option value="popularity">Popularity</option>
                </select>
              </div>
            </div>

            {/* Upcoming / Announced Productions */}
            {upcomingProjects.length > 0 && (
              <div style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(20, 22, 28, 0.8) 100%)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }}>
                <h3 className={styles.sectionHeading} style={{ borderBottom: 'none', paddingBottom: '4px' }}>
                  <Sparkles size={16} color="#c4b5fd" />
                  <span>Upcoming &amp; In-Production Pipeline</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginTop: '10px' }}>
                  {upcomingProjects.map((item: any) => (
                    <Link
                      key={item.anime.id}
                      href={`/anime/${item.anime.slug}`}
                      style={{
                        display: 'flex',
                        gap: '10px',
                        padding: '8px',
                        background: 'rgba(0,0,0,0.4)',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {item.anime.posterUrl && (
                        <img src={item.anime.posterUrl} alt={item.anime.canonicalTitle} style={{ width: '40px', height: '56px', objectFit: 'cover', borderRadius: '4px' }} />
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>{item.anime.canonicalTitle}</span>
                        <span style={{ fontSize: '11px', color: '#fbbf24' }}>{item.relationship.productionStatus || item.anime.status}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {studio.animes?.length === 0 ? (
              <div className={styles.emptyNotice}>
                No anime titles currently recorded for the {formatFilter} format.
              </div>
            ) : (
              <AnimeGrid>
                {studio.animes.map((anime: any) => (
                  <AnimeCard key={anime.id} anime={anime} />
                ))}
              </AnimeGrid>
            )}
          </section>
        )}

        {/* TAB 2: HISTORY & TIMELINE */}
        {activeTab === 'history' && (
          <section className={styles.historySection}>
            {/* Overview / Story */}
            <div className={styles.editorialHistoryCard}>
              <h3 className={styles.sectionHeading}>
                <History size={16} />
                <span>Historical Evolution &amp; Studio Legacy</span>
              </h3>

              {studio.history ? (
                <div className={styles.historyEras}>
                  <div className={styles.historyEraBlock}>
                    <h4 className={styles.eraTitle}>1. Founding &amp; Early Identity</h4>
                    <p className={styles.eraText}>{studio.history.foundingEra}</p>
                  </div>

                  <div className={styles.historyEraBlock}>
                    <h4 className={styles.eraTitle}>2. Breakthrough &amp; Golden Age</h4>
                    <p className={styles.eraText}>{studio.history.goldenAge}</p>
                  </div>

                  <div className={styles.historyEraBlock}>
                    <h4 className={styles.eraTitle}>3. Modern Productions &amp; Global Impact</h4>
                    <p className={styles.eraText}>{studio.history.modernEra}</p>
                  </div>
                </div>
              ) : (
                <p className={styles.fallbackAbout}>{studio.about || 'Studio historical details recorded in canonical archive.'}</p>
              )}
            </div>

            {/* Historical Eras Navigator */}
            {historyEras.length > 0 && (
              <div className={styles.timelineCard}>
                <h3 className={styles.sectionHeading}>
                  <Calendar size={16} />
                  <span>Historical Production Eras</span>
                </h3>
                <div className={styles.eraNavGrid}>
                  <div
                    className={`${styles.eraNavCard} ${selectedEraId === 'ALL' ? styles.eraNavCardActive : ''}`}
                    onClick={() => setSelectedEraId('ALL')}
                  >
                    <span className={styles.eraNavName}>All Eras</span>
                    <span className={styles.eraNavPeriod}>Complete Chronicle</span>
                  </div>
                  {historyEras.map((era) => (
                    <div
                      key={era.id}
                      className={`${styles.eraNavCard} ${selectedEraId === era.id ? styles.eraNavCardActive : ''}`}
                      onClick={() => setSelectedEraId(selectedEraId === era.id ? 'ALL' : era.id)}
                    >
                      <span className={styles.eraNavName}>{era.name}</span>
                      <span className={styles.eraNavPeriod}>{era.displayPeriod}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Timeline */}
            <div className={styles.timelineCard}>
              <div className={styles.timelineControlsBar}>
                <h3 className={styles.sectionHeading} style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  <Sparkles size={16} />
                  <span>Chronological Production Milestones</span>
                </h3>

                <div className={styles.timelineFilters}>
                  <button
                    type="button"
                    className={`${styles.timelinePill} ${historyMajorOnly ? styles.timelinePillActive : ''}`}
                    onClick={() => setHistoryMajorOnly(!historyMajorOnly)}
                  >
                    <Star size={12} fill="currentColor" aria-hidden="true" /> Major Milestones Only
                  </button>
                  <select
                    className={styles.sortSelect}
                    value={selectedHistoryType}
                    onChange={(e) => setSelectedHistoryType(e.target.value)}
                  >
                    <option value="ALL">All Event Types</option>
                    <option value="FOUNDING">Founding</option>
                    <option value="MAJOR_PROJECT">Major Projects</option>
                    <option value="LEADERSHIP">Leadership</option>
                    <option value="MILESTONE">Milestones</option>
                    <option value="EXPANSION">Expansions</option>
                    <option value="AWARD">Awards</option>
                    <option value="PRODUCTION_EVENT">Production Events</option>
                  </select>
                </div>
              </div>

              {/* Milestones List */}
              {(() => {
                const filtered = (historyEvents.length > 0 ? historyEvents : (studio.timeline || []).map((t: any, i: number) => ({
                  id: `fallback-${i}`,
                  title: t.title,
                  displayDate: String(t.year),
                  shortDescription: t.description,
                  eventType: t.category,
                  importance: t.category === 'FOUNDING' || t.category === 'BREAKTHROUGH' ? 'MAJOR' : 'NORMAL',
                  anime: t.relatedAnime ? { canonicalTitle: t.relatedAnime } : null,
                }))).filter((e: any) => {
                  if (historyMajorOnly && e.importance !== 'MAJOR' && e.importance !== 'CRITICAL') return false;
                  if (selectedHistoryType !== 'ALL' && e.eventType !== selectedHistoryType) return false;
                  if (selectedEraId !== 'ALL' && e.eraId && e.eraId !== selectedEraId) return false;
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                      No milestones recorded matching the selected filter criteria.
                    </div>
                  );
                }

                return (
                  <div className={styles.timelineList}>
                    {filtered.map((event: any) => {
                      const isExpanded = expandedEventId === event.id;
                      const isMajor = event.importance === 'MAJOR' || event.importance === 'CRITICAL';

                      return (
                        <div
                          key={event.id}
                          className={`${styles.timelineItem}`}
                          onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                        >
                          <div className={styles.timelineNode} />
                          <div className={styles.timelineYearBadge}>{event.displayDate}</div>
                          <div className={`${styles.timelineContent} ${isMajor ? styles.timelineFeaturedCard : ''}`}>
                            <div className={styles.timelineHeader}>
                              <h4 className={styles.timelineTitle}>{event.title}</h4>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span className={styles.timelineCategory}>{event.eventType}</span>
                                {isMajor && <span className={styles.timelineMajorBadge}>{event.importance}</span>}
                              </div>
                            </div>

                            <p className={styles.timelineDesc}>{event.shortDescription || event.fullDescription}</p>

                            {/* Linked Anime Project Link */}
                            {event.anime && (
                              <div className={styles.timelineAnimeCard}>
                                {event.anime.posterUrl && (
                                  <img src={event.anime.posterUrl} alt={event.anime.canonicalTitle} className={styles.timelineAnimePoster} />
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                                    <Film size={12} aria-hidden="true" /> {event.anime.canonicalTitle}
                                  </span>
                                  {event.anime.score && (
                                    <span style={{ fontSize: '11px', color: '#fbbf24' }}>
                                      Score: <Star size={12} fill="currentColor" aria-hidden="true" /> {event.anime.score}{event.anime.type ? ` · ${event.anime.type}` : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className={styles.timelineExpandedDetails}>
                                {event.fullDescription && event.fullDescription !== event.shortDescription && (
                                  <p style={{ margin: 0, lineHeight: 1.6, color: '#e2e8f0' }}>{event.fullDescription}</p>
                                )}
                                {event.person && (
                                  <div style={{ fontSize: '12px', color: '#a78bfa' }}>
                                    <Users size={12} aria-hidden="true" /> Key Personnel: <strong>{event.person.name}</strong>
                                  </div>
                                )}
                                {event.source && (
                                  <div className={styles.timelineSourceFooter}>
                                    <span>Verified Source: {event.source}</span>
                                    {event.sourceUrl && (
                                      <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#8b5cf6', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <ExternalLink size={11} /> View Source
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </section>
        )}

        {/* TAB 3: FOUNDERS & CREATORS */}
        {activeTab === 'founders' && (
          <section className={styles.foundersSection}>
            <div className={styles.foundersCard}>
              <h3 className={styles.sectionHeading}>
                <Users size={16} />
                <span>Founders &amp; Pioneer Leadership</span>
              </h3>
              <div className={styles.foundersGrid}>
                {studio.founders && studio.founders.length > 0 ? (
                  studio.founders.map((founder: any, idx: number) => (
                    <Link
                      key={idx}
                      href={`/person/${founder.slug}`}
                      className={styles.founderCard}
                    >
                      <div className={styles.founderAvatarWrap}>
                        {founder.imageUrl ? (
                          <Image
                            src={founder.imageUrl}
                            alt={founder.name}
                            fill
                            className={styles.founderAvatarImg}
                            unoptimized
                          />
                        ) : (
                          <Users size={28} className={styles.avatarPlaceholder} />
                        )}
                      </div>
                      <div className={styles.founderInfo}>
                        <h4 className={styles.founderName}>{founder.name}</h4>
                        <span className={styles.founderRole}>{founder.role}</span>
                        {founder.bio && <p className={styles.founderBio}>{founder.bio}</p>}
                        <span className={styles.viewProfileLink}>View Creator Profile <ArrowRight size={13} aria-hidden="true" /></span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className={styles.emptyNotice}>Founder records indexed in OTAKUVA People database.</p>
                )}
              </div>
            </div>

            {/* Key Directors & Creators */}
            {studio.keyPersonnel && studio.keyPersonnel.length > 0 && (
              <div className={styles.personnelCard}>
                <h3 className={styles.sectionHeading}>
                  <Film size={16} />
                  <span>Key Directors &amp; Master Creators</span>
                </h3>
                <div className={styles.personnelGrid}>
                  {studio.keyPersonnel.map((person: any, idx: number) => (
                    <Link
                      key={idx}
                      href={`/person/${person.slug}`}
                      className={styles.personnelItem}
                    >
                      <span className={styles.personnelName}>{person.name}</span>
                      <span className={styles.personnelRole}>{person.role}</span>
                      {person.bio && <p className={styles.personnelBio}>{person.bio}</p>}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB: ANALYTICS & STATS */}
        {activeTab === 'analytics' && (
          <section className={styles.statsCard} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <h3 className={styles.sectionHeading} style={{ margin: 0 }}>
                <TrendingUp size={16} />
                <span>Studio Intelligence &amp; Advanced Metrics Engine</span>
              </h3>

              {/* Time Period Filter */}
              <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                {[
                  { id: 'ALL_TIME', label: 'All Time' },
                  { id: 'LAST_12_MONTHS', label: '12M' },
                  { id: 'LAST_90_DAYS', label: '90D' },
                  { id: 'LAST_30_DAYS', label: '30D' },
                  { id: 'LAST_7_DAYS', label: '7D' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setAnalyticsPeriod(p.id)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      borderRadius: '5px',
                      border: 'none',
                      cursor: 'pointer',
                      background: analyticsPeriod === p.id ? '#8b5cf6' : 'transparent',
                      color: analyticsPeriod === p.id ? '#ffffff' : '#94a3b8',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Performance & Momentum Hero Cards */}
            {advancedAnalytics && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '14px', background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(20,22,28,0.8))', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#c4b5fd', fontWeight: 700, textTransform: 'uppercase' }}>Performance Index</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>v1</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', margin: '4px 0' }}>
                    {advancedAnalytics.performance.score} <span style={{ fontSize: '13px', color: '#94a3b8' }}>/ 100</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                    Completion: {(advancedAnalytics.performance.completionRate * 100).toFixed(0)}% · {advancedAnalytics.performance.watchCount} Watchers
                  </span>
                </div>

                <div style={{ padding: '14px', background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(20,22,28,0.8))', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase' }}>Bayesian Rating</span>
                    <span style={{ fontSize: '10px', color: '#93c5fd', background: 'rgba(59,130,246,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                      {advancedAnalytics.ratings.confidence} CONFIDENCE
                    </span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#fbbf24', margin: '4px 0' }}>
                    <Star size={12} fill="currentColor" aria-hidden="true" /> {advancedAnalytics.ratings.bayesianScore || advancedAnalytics.ratings.rawAverage || 'N/A'}
                  </div>
                  <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                    {advancedAnalytics.ratings.consistency?.tier.replace(/_/g, ' ')} (σ = {advancedAnalytics.ratings.consistency?.standardDeviation})
                  </span>
                </div>

                <div style={{ padding: '14px', background: 'linear-gradient(135deg, rgba(234,179,8,0.15), rgba(20,22,28,0.8))', borderRadius: '8px', border: '1px solid rgba(234,179,8,0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#fde047', fontWeight: 700, textTransform: 'uppercase' }}>Studio Momentum</span>
                    <span style={{ fontSize: '10px', color: '#fde047', background: 'rgba(234,179,8,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                      {advancedAnalytics.momentum.tier}
                    </span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', margin: '4px 0' }}>
                    {advancedAnalytics.momentum.score} <span style={{ fontSize: '13px', color: '#94a3b8' }}>/ 100</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                    {advancedAnalytics.communityAndNews.newsCount} News · {advancedAnalytics.communityAndNews.discussionCount} Discussions
                  </span>
                </div>

                <div style={{ padding: '14px', background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(20,22,28,0.8))', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#6ee7b7', fontWeight: 700, textTransform: 'uppercase' }}>Genre Diversity</span>
                    <span style={{ fontSize: '10px', color: '#6ee7b7' }}>Shannon Index</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', margin: '4px 0' }}>
                    {(advancedAnalytics.genres.diversity.normalizedDiversity * 100).toFixed(0)}%
                  </div>
                  <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                    {advancedAnalytics.genres.diversity.tier.replace(/_/g, ' ')} (H = {advancedAnalytics.genres.diversity.shannonIndex})
                  </span>
                </div>
              </div>
            )}

            {/* Momentum Drivers & Explainability */}
            {advancedAnalytics?.momentum && (
              <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>Momentum Drivers &amp; Trajectory</h4>
                  <span style={{ fontSize: '11px', color: '#a78bfa' }}>studio_momentum_score_v1</span>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94a3b8' }}>
                  {advancedAnalytics.momentum.explanation}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                  {advancedAnalytics.momentum.contributingSignals?.map((sig: any) => (
                    <div key={sig.signal} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                        <span style={{ color: '#cbd5e1' }}>{sig.signal}</span>
                        <span style={{ color: '#fbbf24', fontWeight: 700 }}>+{sig.contribution} pts</span>
                      </div>
                      <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
                        <div style={{ width: `${(sig.contribution / (sig.weight * 100)) * 100}%`, height: '100%', background: '#8b5cf6', borderRadius: '2px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Predictive Forecast Card (Explicitly Labeled) */}
            {advancedAnalytics?.forecast && (
              <div style={{ padding: '16px', background: 'linear-gradient(90deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)', borderRadius: '8px', border: '1px solid rgba(100, 116, 139, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} color="#60a5fa" />
                    <h4 style={{ margin: 0, fontSize: '13px', color: '#ffffff' }}>Statistical Forecast &amp; Trend Projection</h4>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#60a5fa', background: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                    PREDICTION / {advancedAnalytics.forecast.model}
                  </span>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '11.5px', color: '#94a3b8' }}>
                  Trend Classification: <strong style={{ color: '#4ade80' }}>{advancedAnalytics.forecast.trend}</strong> · Confidence: {advancedAnalytics.forecast.confidence}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  <div style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>7-Day Projected Index</span>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', margin: '2px 0' }}>
                      {advancedAnalytics.forecast.horizons.days7.expectedEngagementIndex}
                    </div>
                    <span style={{ fontSize: '10.5px', color: '#64748b' }}>{advancedAnalytics.forecast.horizons.days7.anticipatedInterest}</span>
                  </div>
                  <div style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>30-Day Projected Index</span>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', margin: '2px 0' }}>
                      {advancedAnalytics.forecast.horizons.days30.expectedEngagementIndex}
                    </div>
                    <span style={{ fontSize: '10.5px', color: '#64748b' }}>{advancedAnalytics.forecast.horizons.days30.anticipatedInterest}</span>
                  </div>
                  <div style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>90-Day Projected Index</span>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', margin: '2px 0' }}>
                      {advancedAnalytics.forecast.horizons.days90.expectedEngagementIndex}
                    </div>
                    <span style={{ fontSize: '10.5px', color: '#64748b' }}>{advancedAnalytics.forecast.horizons.days90.anticipatedInterest}</span>
                  </div>
                </div>
                <div style={{ marginTop: '10px', fontSize: '10.5px', color: '#64748b', fontStyle: 'italic' }}>
                  {advancedAnalytics.forecast.disclaimer}
                </div>
              </div>
            )}

            {/* Overview Stats Grid */}
            {studioAnalytics && (
              <div className={styles.statsGrid}>
                <div className={styles.statMetricCard}>
                  <span className={styles.statMetricLabel}>Total Productions</span>
                  <span className={styles.statMetricVal}>{studioAnalytics.overview.totalProjects} Titles</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{studioAnalytics.overview.totalEpisodes} episodes produced</span>
                </div>
                <div className={styles.statMetricCard}>
                  <span className={styles.statMetricLabel}>Average Score</span>
                  <span className={styles.statMetricVal} style={{ color: '#fbbf24' }}>
                    {studioAnalytics.overview.averageScore ? <><Star size={12} fill="currentColor" aria-hidden="true" /> {studioAnalytics.overview.averageScore}</> : 'N/A'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{studioAnalytics.overview.sampleSizeContext}</span>
                </div>
                <div className={styles.statMetricCard}>
                  <span className={styles.statMetricLabel}>Total Watches</span>
                  <span className={styles.statMetricVal} style={{ color: '#4ade80' }}>
                    {studioAnalytics.engagement.totalWatches.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{studioAnalytics.engagement.totalFavorites} favorites · {studioAnalytics.engagement.totalReviews} reviews</span>
                </div>
              </div>
            )}

            {/* Highlights */}
            {studioAnalytics.highlights && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                {studioAnalytics.highlights.highestRated && (
                  <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: '11px', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 700 }}>Highest Rated Project</span>
                    <h4 style={{ margin: '4px 0', fontSize: '14px', color: '#ffffff' }}>{studioAnalytics.highlights.highestRated.title}</h4>
                    <span style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: 700 }}>Score: <Star size={12} fill="currentColor" aria-hidden="true" /> {studioAnalytics.highlights.highestRated.score}</span>
                  </div>
                )}
                {studioAnalytics.highlights.mostReviewed && (
                  <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: '11px', color: '#60a5fa', textTransform: 'uppercase', fontWeight: 700 }}>Most Discussed Project</span>
                    <h4 style={{ margin: '4px 0', fontSize: '14px', color: '#ffffff' }}>{studioAnalytics.highlights.mostReviewed.title}</h4>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{studioAnalytics.highlights.mostReviewed.reviewCount} community reviews</span>
                  </div>
                )}
              </div>
            )}

            {/* Genre & Format Distribution */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#cbd5e1' }}>Genre Specialization Distribution</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {studioAnalytics.genreDistribution.slice(0, 7).map((g: any) => (
                    <div key={g.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                      <span style={{ color: '#ffffff' }}>{g.name}</span>
                      <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{g.percentage}% ({g.count} titles)</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#cbd5e1' }}>Format Portfolio Breakdown</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {studioAnalytics.typeDistribution.map((t: any) => (
                    <div key={t.type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                      <span style={{ color: '#ffffff' }}>{t.type}</span>
                      <span style={{ color: '#60a5fa', fontWeight: 600 }}>{t.percentage}% ({t.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Category / Aspect Ratings (Story, Animation, Characters, Direction, Music) */}
            {studioDashboard?.aspectRatings && (
              <div style={{ padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', color: '#cbd5e1' }}>Community Aspect Quality Scores</h4>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{studioDashboard.aspectRatings.sourceLabel}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  {Object.entries(studioDashboard.aspectRatings.aspects).map(([aspect, score]: any) => (
                    <div key={aspect} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                        <span style={{ textTransform: 'capitalize', color: '#cbd5e1', fontWeight: 600 }}>{aspect.replace(/([A-Z])/g, ' $1')}</span>
                        <span style={{ color: '#fbbf24', fontWeight: 700 }}><Star size={12} fill="currentColor" aria-hidden="true" /> {score}</span>
                      </div>
                      <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${(score / 10) * 100}%`, height: '100%', background: '#8b5cf6', borderRadius: '2px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Temporal Genre Evolution Across Decades */}
            {studioDashboard?.genreEvolution?.length > 0 && (
              <div style={{ padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#cbd5e1' }}>Thematic Evolution Across Decades</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  {studioDashboard.genreEvolution.map((dec: any) => (
                    <div key={dec.decade} style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                        <span>{dec.decade}</span>
                        <span style={{ color: '#94a3b8', fontWeight: 400 }}>{dec.totalProjects} titles</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {dec.topGenres.map((g: any) => (
                          <div key={g.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#cbd5e1' }}>
                            <span>{g.name}</span>
                            <span style={{ color: '#c4b5fd' }}>{g.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Episode-Level Quality & Progression Analytics */}
            {studioDashboard?.episodeAnalytics?.hasSufficientData && (
              <div style={{ padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#cbd5e1' }}>Episode Quality &amp; Progression Curve</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Average Episode Rating</span>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#4ade80' }}>
                      <Star size={12} fill="currentColor" aria-hidden="true" /> {studioDashboard.episodeAnalytics.averageEpisodeScore}
                    </div>
                  </div>
                  {studioDashboard.episodeAnalytics.highestRatedEpisode && (
                    <div style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#fbbf24' }}>Highest Rated Episode</span>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#ffffff' }}>
                        {studioDashboard.episodeAnalytics.highestRatedEpisode.animeTitle} Ep {studioDashboard.episodeAnalytics.highestRatedEpisode.episodeNumber} (<Star size={12} fill="currentColor" aria-hidden="true" /> {studioDashboard.episodeAnalytics.highestRatedEpisode.score})
                      </div>
                    </div>
                  )}
                </div>

                {studioDashboard.episodeAnalytics.episodeProgression.length > 0 && (
                  <div>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
                      Pacing Retention (Average Score by Episode #):
                    </span>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
                      {studioDashboard.episodeAnalytics.episodeProgression.map((ep: any) => (
                        <div key={ep.episodeNumber} style={{ minWidth: '60px', padding: '6px 8px', background: 'rgba(139,92,246,0.15)', borderRadius: '6px', textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Ep {ep.episodeNumber}</span>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#c4b5fd' }}><Star size={12} fill="currentColor" aria-hidden="true" /> {ep.averageScore}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* TAB: COMMUNITIES */}
        {activeTab === 'communities' && (
          <section className={styles.statsCard} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 className={styles.sectionHeading}>
              <Users size={16} />
              <span>Studio Fan Communities &amp; Hubs</span>
            </h3>

            {studioCommunities.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {studioCommunities.map((c: any) => (
                  <div
                    key={c.id}
                    style={{
                      padding: '16px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>{c.name}</span>
                        <span className={styles.badge} style={{ fontSize: '10px' }}>{c.visibility}</span>
                      </div>
                      <p style={{ fontSize: '12.5px', color: '#94a3b8', margin: '8px 0 0 0', lineHeight: 1.4 }}>{c.description}</p>
                    </div>

                    {c.recentDiscussions?.length > 0 && (
                      <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ fontSize: '11px', color: '#c4b5fd', fontWeight: 600 }}>Active Topic:</span>
                        <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.recentDiscussions[0].title}
                        </p>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>{c.memberCount} members</span>
                      <Link
                        href={`/c/${c.slug}`}
                        style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: 600, textDecoration: 'none' }}
                      >
                        {c.isMember ? 'Open Community' : 'Join Hub'} <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyNotice}>
                No official community hubs created yet for {studio.name}. Connect with fellow anime enthusiasts in the global{' '}
                <Link href="/communities" className={styles.globalNewsLink}>Communities Directory</Link>.
              </div>
            )}
          </section>
        )}

        {/* TAB 4: STUDIO DNA & STATS */}
        {activeTab === 'dna' && (
          <section className={styles.dnaSection}>
            <div className={styles.dnaCard}>
              <h3 className={styles.sectionHeading}>
                <Sparkles size={16} />
                <span>Studio Artistic Identity &amp; DNA</span>
              </h3>

              <div className={styles.dnaDetailsGrid}>
                <div className={styles.dnaBlock}>
                  <span className={styles.dnaBlockLabel}>Signature Visual Style</span>
                  <p className={styles.dnaBlockVal}>{studio.dna?.signatureStyle}</p>
                </div>

                <div className={styles.dnaBlock}>
                  <span className={styles.dnaBlockLabel}>Artistic Philosophy</span>
                  <p className={styles.dnaBlockVal}>{studio.dna?.artisticPhilosophy}</p>
                </div>

                <div className={styles.dnaBlock}>
                  <span className={styles.dnaBlockLabel}>Core Production Genres</span>
                  <div className={styles.genreTagsRow}>
                    {studio.dna?.primaryGenres?.map((g: string) => (
                      <span key={g} className={styles.genreTagPill}>
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Production Breakdown */}
            <div className={styles.statsCard}>
              <h3 className={styles.sectionHeading}>
                <TrendingUp size={16} />
                <span>Production Portfolio Analytics</span>
              </h3>

              <div className={styles.statsGrid}>
                <div className={styles.statMetricCard}>
                  <span className={styles.statMetricLabel}>Total Canonical Works</span>
                  <span className={styles.statMetricVal}>{studio.totalWorks}</span>
                </div>
                <div className={styles.statMetricCard}>
                  <span className={styles.statMetricLabel}>Average Score</span>
                  <span className={styles.statMetricVal}><Star size={12} fill="currentColor" aria-hidden="true" /> {studio.stats?.averageScore}</span>
                </div>
                <div className={styles.statMetricCard}>
                  <span className={styles.statMetricLabel}>TV Broadcast Series</span>
                  <span className={styles.statMetricVal}>{studio.stats?.tvCount}</span>
                </div>
                <div className={styles.statMetricCard}>
                  <span className={styles.statMetricLabel}>Theatrical Movies</span>
                  <span className={styles.statMetricVal}>{studio.stats?.movieCount}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB 5: STUDIO NEWS */}
        {activeTab === 'news' && (
          <section className={styles.newsSection}>
            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {['ALL', 'ANNOUNCEMENTS', 'PRODUCTION', 'RELEASE', 'STAFF', 'AWARDS'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNewsCategory(cat)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: newsCategory === cat ? '#8b5cf6' : 'rgba(255, 255, 255, 0.05)',
                    color: newsCategory === cat ? '#ffffff' : '#94a3b8',
                    border: newsCategory === cat ? '1px solid #8b5cf6' : '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {studioNews.length > 0 ? (
              <div className={styles.newsGrid}>
                {studioNews.map((article: any) => (
                  <article key={article.id} className={styles.newsItemCard}>
                    <div className={styles.newsItemHeader}>
                      <span className={styles.newsSourceBadge}>{article.sourceName}</span>
                      <span className={styles.newsDate}>
                        {new Date(article.publishedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <h3 className={styles.newsItemTitle}>
                      <Link href={`/news/${article.slug}`}>{article.title}</Link>
                    </h3>

                    {article.summary && (
                      <p className={styles.newsItemSummary}>{article.summary}</p>
                    )}

                    <div className={styles.newsItemFooter} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Link href={`/news/${article.slug}`} className={styles.openStoryBtn}>
                        Read in Reader <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                      {article.canonicalUrl && (
                        <a
                          href={article.canonicalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '11.5px', color: '#64748b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          <span>Original</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyNotice}>
                No specific news dispatches currently recorded for {studio.name} under {newsCategory}. Explore the global{' '}
                <Link href="/news" className={styles.globalNewsLink}>
                  News Platform
                </Link>{' '}
                for industry announcements.
              </div>
            )}
          </section>
        )}
      </main>

      {/* 4. RELATED / SIMILAR STUDIOS DISCOVERY CAROUSEL */}
      {relatedStudios.length > 0 && (
        <footer style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <h3 className={styles.sectionHeading}>
            <Sparkles size={16} color="#c4b5fd" />
            <span>Similar &amp; Related Animation Studios</span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px', marginTop: '12px' }}>
            {relatedStudios.map((rs: any) => (
              <Link
                key={rs.id}
                href={`/studio/${rs.slug}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  textDecoration: 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '13px' }}>{rs.name}</span>
                  <span style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 600 }}>{rs.similarityPercentage}% Match</span>
                </div>
                <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: 0, lineHeight: 1.3 }}>{rs.explanation}</p>
              </Link>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
