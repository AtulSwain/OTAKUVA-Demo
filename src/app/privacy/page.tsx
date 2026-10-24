import { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';
import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Privacy Policy — OTAKUVA',
  robots: { index: false, follow: false },
};

interface Clause {
  heading: string;
  body: string;
}

// Placeholder scaffolding — see the banner below. Unlike the other
// clauses here, the "your rights" section describes real, already-built
// mechanisms (DELETE /api/account, GET /api/account/export) rather than
// a stand-in, since that's factual and not something a lawyer needs to
// invent — but the legal framing around it (which laws apply to which
// users, required response timelines, identity-verification requirements
// before honoring a request, etc.) still needs review.
const CLAUSES: Clause[] = [
  {
    heading: '1. What data OTAKUVA collects',
    body: 'Placeholder — account data (username, email, password hash), profile data (bio, avatar, banner), activity data (library entries, episode progress, ratings, reviews, favorites), community content (discussions, comments, messages, uploaded media), and technical data (IP address for rate limiting/abuse prevention, request logs).',
  },
  {
    heading: '2. How OTAKUVA uses data',
    body: 'Placeholder — operating the service (tracking, recommendations, community features), abuse/anomaly detection (e.g. rating velocity checks), error tracking and debugging (Sentry, with user id only — see docs/production/RUNBOOK.md), and legal compliance.',
  },
  {
    heading: '3. Third-party data sources & processors',
    body: 'Placeholder — catalog data is pulled from third-party anime databases (AniList, MyAnimeList/Jikan); infrastructure processors likely include the hosting provider, the database provider, object storage (Cloudflare R2), and error tracking (Sentry). List every actual subprocessor and what they receive.',
  },
  {
    heading: '4. Cookies & sessions',
    body: 'Placeholder — OTAKUVA sets a single httpOnly session cookie (anilog_token) to keep you signed in; describe its purpose, lifetime (30 days), and that it is not used for cross-site tracking or advertising.',
  },
  {
    heading: '5. Data retention',
    body: 'Placeholder — how long data is kept while an account is active, and what happens to data after account deletion (see §6 below — note some records may be retained in anonymized form, e.g. audit log entries with the account reference removed, rather than deleted outright).',
  },
  {
    heading: '6. Your rights (access, correction, deletion)',
    body:
      'You can download a copy of your personal data at any time from GET /api/account/export (returns a full JSON export), and permanently delete your account and associated personal data via DELETE /api/account. Deleting your account is immediate and irreversible once confirmed, and requires your password plus a typed confirmation. If you own a community, you must transfer or delete it first — deletion is blocked otherwise, so your request doesn’t silently destroy other members’ content. [LEGAL REVIEW NEEDED: confirm whether any data must legally be retained past deletion (e.g. active moderation cases), and whether these mechanisms satisfy GDPR Art. 15/17 and CCPA in every jurisdiction OTAKUVA serves — see the code comments in src/app/api/account/route.ts and src/app/api/account/export/route.ts for the specific open questions.]',
  },
  {
    heading: '7. Children’s privacy',
    body: 'Placeholder — minimum age to use OTAKUVA and what happens if an underage account is discovered.',
  },
  {
    heading: '8. International data transfers',
    body: 'Placeholder — if data is processed/stored in a different jurisdiction than the user, describe the transfer mechanism (e.g. standard contractual clauses) once hosting is finalized.',
  },
  {
    heading: '9. Changes to this policy',
    body: 'Placeholder — how and when OTAKUVA may update this policy, and how users are notified of material changes.',
  },
  {
    heading: '10. Contact',
    body: 'Placeholder — a real contact method for privacy requests and questions, once one exists (a dedicated privacy/compliance email is standard).',
  },
];

export default function PrivacyPage() {
  return (
    <div className={styles.legalPage}>
      <div className={styles.reviewBanner} role="alert">
        <AlertTriangle size={20} className={styles.reviewBannerIcon} aria-hidden="true" />
        <div>
          <div className={styles.reviewBannerTitle}>[LEGAL REVIEW NEEDED]</div>
          <p className={styles.reviewBannerText}>
            This page is placeholder plumbing only — every clause below is a stand-in for real
            legal text (except the factual description of the data export/deletion mechanisms in
            §6, which describes what is actually implemented today). Nothing here has been drafted
            or reviewed by a lawyer, and it is not a binding Privacy Policy until one has. Do not
            launch publicly with this content live.
          </p>
        </div>
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>Privacy Policy</h1>
        <span className={styles.lastUpdated}>Last updated: [DATE — PENDING LEGAL REVIEW]</span>
      </div>

      <div className={styles.sections}>
        {CLAUSES.map((clause) => (
          <section key={clause.heading} className={styles.section}>
            <h2 className={styles.sectionHeading}>
              {clause.heading}
              <span className={styles.sectionTag}>
                {clause.heading.startsWith('6.') ? 'Factual — review framing' : 'Review needed'}
              </span>
            </h2>
            <p className={styles.sectionBody}>{clause.body}</p>
          </section>
        ))}
      </div>

      <p className={styles.footNote}>
        Questions about this policy should go to OTAKUVA’s privacy/compliance contact once one is
        established. See also the <a href="/terms">Terms of Service</a> and{' '}
        <a href="/report-content">reporting content</a>.
      </p>
    </div>
  );
}
