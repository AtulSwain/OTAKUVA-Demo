import { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: 'Community Guidelines — OTAKUVA',
};

interface Rule {
  heading: string;
  body: string;
}

// Plain-language rules matching what moderators can actually act on — each
// one maps to a report reason in /report-content (SPAM, HARASSMENT, HATE,
// OFFENSIVE, SPOILER_MISUSE, PIRACY, MISINFORMATION). Linked from the footer,
// Terms §4 and community creation. Final wording still needs owner/legal
// sign-off, like the Terms and Privacy pages (see the banner).
const RULES: Rule[] = [
  {
    heading: '1. Be respectful',
    body: 'Disagree about a show as much as you like, but not with the person. No harassment, threats, personal attacks, or pile-ons, and no sharing someone else’s private information.',
  },
  {
    heading: '2. No hate speech',
    body: 'Content that attacks people for their race, ethnicity, nationality, religion, gender, gender identity, sexual orientation, disability, or age is removed, and accounts that post it may be suspended.',
  },
  {
    heading: '3. Tag your spoilers',
    body: 'Mark spoilers in reviews, discussions, and chat using the spoiler option. Don’t put spoilers in titles or headlines, and don’t use the spoiler tag to hide content that breaks other rules.',
  },
  {
    heading: '4. No piracy',
    body: 'OTAKUVA is not a streaming site. Don’t post links to unofficial streams, downloads, or scanlations. Pointing people to official services is always welcome — anime pages list where to watch.',
  },
  {
    heading: '5. Keep it honest',
    body: 'Rate and review what you have actually watched. Don’t post made-up announcements or “leaks” as fact, impersonate other people or official accounts, or run multiple accounts to push ratings around.',
  },
  {
    heading: '6. No spam or self-promotion floods',
    body: 'No repetitive posts, mass mentions, referral links, or advertising. Sharing your own work in the right community or article is fine; flooding every thread with it is not.',
  },
  {
    heading: '7. Keep it suitable',
    body: 'No sexual content involving minors under any circumstances — including characters drawn or described as minors. Graphic or explicit material needs to stay out of public spaces.',
  },
  {
    heading: '8. Reporting and moderation',
    body: 'If something breaks these rules, report it rather than replying to it. Moderators review reports and may remove content, issue warnings, or suspend accounts depending on severity and history.',
  },
];

export default function CommunityGuidelinesPage() {
  return (
    <div className={styles.legalPage}>
      <div className={styles.reviewBanner} role="note">
        <AlertTriangle size={20} className={styles.reviewBannerIcon} aria-hidden="true" />
        <div>
          <div className={styles.reviewBannerTitle}>Draft — pending owner review</div>
          <p className={styles.reviewBannerText}>
            These guidelines describe the rules OTAKUVA moderation already enforces through its report
            categories. The wording has not yet been reviewed alongside the Terms of Service.
          </p>
        </div>
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>Community Guidelines</h1>
        <span className={styles.lastUpdated}>How we keep reviews, discussions and chat worth reading</span>
      </div>

      <div className={styles.sections}>
        {RULES.map((rule) => (
          <section key={rule.heading} className={styles.section}>
            <h2 className={styles.sectionHeading}>{rule.heading}</h2>
            <p className={styles.sectionBody}>{rule.body}</p>
          </section>
        ))}
      </div>

      <p className={styles.footNote}>
        Seen something that breaks these rules? <Link href="/report-content">Report it</Link>. See also the{' '}
        <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </div>
  );
}
