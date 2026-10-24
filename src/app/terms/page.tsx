import { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';
import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Terms of Service — OTAKUVA',
  robots: { index: false, follow: false },
};

interface Clause {
  heading: string;
  body: string;
}

// Every clause here is placeholder scaffolding, not reviewed legal text —
// see the banner rendered below. Grounded in what OTAKUVA actually does
// (accounts, ratings/reviews, community posts/chat, third-party anime
// data) so a lawyer has a real starting point, not generic boilerplate to
// discard entirely.
const CLAUSES: Clause[] = [
  {
    heading: '1. Acceptance of terms',
    body: 'Placeholder — state that creating an account or using OTAKUVA constitutes acceptance of these terms, and the minimum age / jurisdictional requirements to use the service.',
  },
  {
    heading: '2. Accounts',
    body: 'Placeholder — account registration requirements, accuracy of information, one account per person, account security responsibilities, and grounds for suspension or termination by OTAKUVA.',
  },
  {
    heading: '3. User content (ratings, reviews, discussions, community posts)',
    body: 'Placeholder — the license users grant OTAKUVA to host/display content they post (ratings, reviews, discussion posts, community messages, uploaded images), ownership remaining with the user, and OTAKUVA’s right to remove content that violates policy.',
  },
  {
    heading: '4. Prohibited conduct',
    body: 'Placeholder — harassment, spam, hate speech, piracy links, impersonation, attempts to circumvent moderation, and other conduct grounds for account action. Should reference the community guidelines page and the /report-content flow.',
  },
  {
    heading: '5. Third-party & catalog data',
    body: 'Placeholder — anime/character/staff/studio data is sourced from third-party providers and may be incomplete, delayed, or corrected over time; OTAKUVA is not a streaming service and does not host or distribute copyrighted video content.',
  },
  {
    heading: '6. Moderation',
    body: 'Placeholder — OTAKUVA’s right to review reported content, take moderation action (warnings, content removal, timeouts, bans), and the discretion involved in those decisions.',
  },
  {
    heading: '7. Termination',
    body: 'Placeholder — grounds for OTAKUVA suspending or terminating an account, and the user’s own right to delete their account and data at any time (see the Privacy Policy’s right-to-erasure section).',
  },
  {
    heading: '8. Disclaimers & limitation of liability',
    body: 'Placeholder — standard "as-is" service disclaimer, no warranty on data accuracy/availability, and limitation-of-liability language appropriate to your jurisdiction and risk tolerance.',
  },
  {
    heading: '9. Changes to these terms',
    body: 'Placeholder — how and when OTAKUVA may update these terms, and how users are notified of material changes.',
  },
  {
    heading: '10. Governing law & contact',
    body: 'Placeholder — governing jurisdiction and a real contact method for legal notices, once one exists.',
  },
];

export default function TermsPage() {
  return (
    <div className={styles.legalPage}>
      <div className={styles.reviewBanner} role="alert">
        <AlertTriangle size={20} className={styles.reviewBannerIcon} aria-hidden="true" />
        <div>
          <div className={styles.reviewBannerTitle}>[LEGAL REVIEW NEEDED]</div>
          <p className={styles.reviewBannerText}>
            This page is placeholder plumbing only — every clause below is a stand-in for real
            legal text. Nothing on this page has been drafted or reviewed by a lawyer, and it is
            not a binding Terms of Service until one has. Do not launch publicly with this content
            live.
          </p>
        </div>
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>Terms of Service</h1>
        <span className={styles.lastUpdated}>Last updated: [DATE — PENDING LEGAL REVIEW]</span>
      </div>

      <div className={styles.sections}>
        {CLAUSES.map((clause) => (
          <section key={clause.heading} className={styles.section}>
            <h2 className={styles.sectionHeading}>
              {clause.heading}
              <span className={styles.sectionTag}>Review needed</span>
            </h2>
            <p className={styles.sectionBody}>{clause.body}</p>
          </section>
        ))}
      </div>

      <p className={styles.footNote}>
        Questions about these terms should go to OTAKUVA’s legal/compliance contact once one is
        established. See also the <a href="/privacy">Privacy Policy</a> and{' '}
        <a href="/report-content">reporting content</a>.
      </p>
    </div>
  );
}
