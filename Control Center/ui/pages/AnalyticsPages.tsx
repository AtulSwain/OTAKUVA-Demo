import React from 'react';
import { getAnimeAnalytics, getCollectionAnalytics, getCommunityAnalytics, getMemberAnalytics, getNewsAnalytics } from '@control/lib/analytics';
import { DayBars, KpiGrid, PanelRow, RangeTabs, RankBars } from '../Charts';
import styles from '../control.module.css';

const CATEGORY: Record<string, string> = {
  ANIME: 'Anime',
  ANNOUNCEMENTS: 'Announcements',
  TRAILERS: 'Trailers',
  CASTING: 'Casting',
  PRODUCTION: 'Production',
  STUDIOS: 'Studios',
  INDUSTRY: 'Industry',
  MANGA: 'Manga',
};
const STATUS: Record<string, string> = {
  WATCHING: 'Watching',
  COMPLETED: 'Completed',
  PLAN_TO_WATCH: 'Plan to watch',
  ON_HOLD: 'On hold',
  DROPPED: 'Dropped',
};
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

export const parseDays = (v: string | string[] | undefined) => {
  const d = Number(Array.isArray(v) ? v[0] : v);
  return [7, 30, 90].includes(d) ? d : 30;
};

function Head({ title, base, days, note }: { title: string; base: string; days: number; note?: string }) {
  return (
    <header className={styles.head}>
      <p className={styles.kicker}>Analytics</p>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.toolbar}>
        <RangeTabs base={base} days={days} />
      </div>
      {note && <p className={styles.caption}>{note}</p>}
    </header>
  );
}

const VIEWS_NOTE = 'Page views are counted from 28 Oct 2026 (one per visitor session; bots ignored; nothing personal stored).';

export async function AnimeAnalyticsPage({ days }: { days: number }) {
  const a = await getAnimeAnalytics(days);
  return (
    <div className={styles.page}>
      <Head title="Anime analytics" base="/control/analytics/anime" days={days} note={VIEWS_NOTE} />
      <KpiGrid
        items={[
          { label: 'Anime in the catalog', value: a.kpi.catalog },
          { label: `Added (last ${days} days)`, value: a.kpi.added },
          { label: 'Airing now', value: a.kpi.airing, tone: 'good' },
          { label: 'Upcoming', value: a.kpi.upcoming },
          { label: 'Finished', value: a.kpi.finished },
          { label: 'Added by you (manual)', value: a.kpi.manual },
          { label: `Page views (${days} days)`, value: a.kpi.views },
          { label: 'Page views today', value: a.kpi.viewsToday },
        ]}
      />
      <section className={styles.block}>
        <PanelRow>
          <DayBars title="Anime page views" points={a.viewSeries} unit="views" empty="No views counted yet — they start appearing as people open anime pages." />
          <DayBars title="Added to members' libraries" points={a.libraryAdds} unit="adds" />
        </PanelRow>
      </section>
      <section className={styles.block}>
        <PanelRow>
          <RankBars title="Most viewed anime" items={a.topViewed} unit="views" empty="No views counted yet." />
          <RankBars title="In the most libraries" items={a.topLibrary} unit="members" />
          <RankBars title="Episode retention (community)" items={a.topRetention} format={(v) => `${v}%`} empty="No episode ratings yet." />
        </PanelRow>
      </section>
      <section className={styles.block}>
        <PanelRow>
          <RankBars title="Library status (all members)" items={a.libraryStatus.map((s) => ({ ...s, label: STATUS[s.label] || s.label }))} unit="entries" />
          <RankBars title="Genres in the catalog" items={a.genres} unit="anime" extraLabel="in libraries" />
        </PanelRow>
      </section>
      <section className={styles.block}>
        <PanelRow>
          <RankBars title="Formats" items={a.formats} unit="anime" />
          <RankBars title="By decade" items={a.decades} unit="anime" />
          <RankBars title="Catalog completeness" items={a.completeness} format={(v) => `${v}%`} />
        </PanelRow>
      </section>
    </div>
  );
}

export async function NewsAnalyticsPage({ days }: { days: number }) {
  const a = await getNewsAnalytics(days);
  return (
    <div className={styles.page}>
      <Head title="News analytics" base="/control/analytics/news" days={days} note="“Opened” counts readers opening a story (tracked since Oct 2026)." />
      <KpiGrid
        items={[
          { label: 'Published stories', value: a.kpi.published },
          { label: 'Published today (24h)', value: a.kpi.day },
          { label: 'Published this week', value: a.kpi.week },
          { label: 'Written by OTAKUVA', value: a.kpi.own },
          { label: 'Featured', value: a.kpi.featured },
          { label: `Stories opened (${days} days)`, value: a.kpi.opens, tone: 'good' },
          { label: 'Clicks to source', value: a.kpi.sourceClicks },
          { label: 'Shares', value: a.kpi.shares },
        ]}
      />
      <section className={styles.block}>
        <PanelRow>
          <DayBars title="Stories published" points={a.publishedSeries} unit="stories" />
          <DayBars title="Stories opened by readers" points={a.opensSeries} unit="opens" />
        </PanelRow>
      </section>
      <section className={styles.block}>
        <PanelRow>
          <RankBars title="Most opened stories" items={a.topOpened} unit="opens" empty="No story opens in this period." />
          <RankBars title="Your OTAKUVA stories" items={a.own} unit="reads" empty="You haven't written a story yet." />
        </PanelRow>
      </section>
      <section className={styles.block}>
        <PanelRow>
          <RankBars title="By category" items={a.byCategory.map((c) => ({ ...c, label: CATEGORY[c.label] || c.label }))} unit="stories" />
          <RankBars title="By source" items={a.bySource} unit="stories" />
        </PanelRow>
      </section>
    </div>
  );
}

export async function CollectionAnalyticsPage({ days }: { days: number }) {
  const a = await getCollectionAnalytics(days);
  return (
    <div className={styles.page}>
      <Head title="Collections & charts" base="/control/analytics/collections" days={days} note={VIEWS_NOTE} />
      <KpiGrid
        items={[
          { label: 'Collections (all)', value: a.kpi.lists },
          { label: 'Public', value: a.kpi.public },
          { label: 'Shared by link', value: a.kpi.link },
          { label: 'Private', value: a.kpi.private },
          { label: 'Members with collections', value: a.kpi.owners },
          { label: 'Anime saved in collections', value: a.kpi.items },
          { label: 'Average size', value: a.kpi.avg },
          { label: `Collection views (${days} days)`, value: a.kpi.views },
        ]}
      />
      <section className={styles.block}>
        <PanelRow>
          <DayBars title="Collections created" points={a.createdSeries} unit="collections" />
          <DayBars title="Collection views" points={a.viewSeries} unit="views" empty="No views counted yet." />
        </PanelRow>
      </section>
      <section className={styles.block}>
        <PanelRow>
          <RankBars title="Most viewed collections" items={a.topViewed} unit="views" empty="No views counted yet." />
          <RankBars title="Largest shared collections" items={a.largest} unit="anime" />
          <RankBars title="Anime in the most collections" items={a.mostCollected} unit="collections" />
        </PanelRow>
      </section>
      <section className={styles.block}>
        <PanelRow>
          <RankBars title="Your published charts — views" items={a.chartViews} unit="views" empty="No published charts yet." />
        </PanelRow>
      </section>
    </div>
  );
}

export async function MemberAnalyticsPage({ days }: { days: number }) {
  const a = await getMemberAnalytics(days);
  return (
    <div className={styles.page}>
      <Head title="Member analytics" base="/control/analytics/members" days={days} note="“Active” = opened the site while signed in (tracked since 28 Oct 2026). “Did something” counts rating, reviewing, tracking or posting." />
      <KpiGrid
        items={[
          { label: 'Members', value: a.kpi.total },
          { label: `New (last ${days} days)`, value: a.kpi.new },
          { label: 'Active today', value: a.kpi.today, tone: 'good' },
          { label: 'Active this week', value: a.kpi.week },
          { label: 'Active this month', value: a.kpi.month, note: `${pct(a.kpi.month, a.kpi.total)} of members` },
          { label: 'Not active (30+ days)', value: a.kpi.inactive, tone: 'warn' },
          { label: 'Phone verified', value: a.kpi.verified, note: `${pct(a.kpi.verified, a.kpi.total)} of members` },
          { label: 'Follows', value: a.kpi.follows },
        ]}
      />
      <section className={styles.block}>
        <PanelRow>
          <DayBars title="Sign-ups" points={a.signupSeries} unit="new members" />
          <DayBars title="Members who did something" points={a.activeSeries} unit="member-days" />
        </PanelRow>
      </section>
      <section className={styles.block}>
        <PanelRow>
          <RankBars title="Most active members" items={a.topActive} unit="actions" />
          <RankBars title="Most followed" items={a.topFollowed} unit="followers" />
          <RankBars title="Roles" items={a.roles} unit="accounts" />
        </PanelRow>
      </section>
    </div>
  );
}

export async function CommunityAnalyticsPage({ days }: { days: number }) {
  const a = await getCommunityAnalytics(days);
  return (
    <div className={styles.page}>
      <Head title="Community analytics" base="/control/analytics/community" days={days} />
      <KpiGrid
        items={[
          { label: 'Reviews', value: a.kpi.reviews, note: `${a.kpi.creatorReviews} by creators` },
          { label: 'Episode ratings', value: a.kpi.ratings },
          { label: 'Hype votes', value: a.kpi.hype },
          { label: 'Favorites', value: a.kpi.favorites },
          { label: 'Discussions', value: a.kpi.discussions },
          { label: 'Articles', value: a.kpi.articles },
          { label: 'Communities', value: a.kpi.communities },
          { label: 'Open reports', value: a.kpi.openReports, tone: a.kpi.openReports ? 'warn' : undefined },
        ]}
      />
      <section className={styles.block}>
        <PanelRow>
          <DayBars title="Reviews written" points={a.reviewSeries} unit="reviews" />
          <DayBars title="Episodes rated" points={a.ratingSeries} unit="ratings" />
          <DayBars title="Hype votes" points={a.hypeSeries} unit="votes" />
        </PanelRow>
      </section>
      <section className={styles.block}>
        <PanelRow>
          <RankBars title="Top reviewers" items={a.topReviewers} unit="reviews" />
          <RankBars title="Biggest communities" items={a.communities} unit="members" />
          <RankBars title="Articles (views + likes)" items={a.topArticles} />
        </PanelRow>
      </section>
      <section className={styles.block}>
        <PanelRow>
          <DayBars title="Article views" points={a.articleViewSeries} unit="views" empty="No article views counted yet." />
          <RankBars title="Reports" items={a.reports} unit="reports" empty="No reports." />
        </PanelRow>
      </section>
    </div>
  );
}
