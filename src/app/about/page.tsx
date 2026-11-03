import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, Compass, MessagesSquare, Sparkles } from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { SupportEmailCard } from '../../components/support/SupportEmailCard';
import { ABOUT_ME } from '../../content/about';
import styles from '../info.module.css';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'What OTAKUVA is, who makes it, and how to get in touch.',
  alternates: { canonical: '/about' },
};

/**
 * About Us (2026-11-03, owner): what OTAKUVA is (only things the site really
 * does), "About me" from src/content/about.ts (hidden until filled in),
 * the support address, and links to the support terms and T&C.
 */
const WHAT_YOU_CAN_DO = [
  { icon: Compass, title: 'Discover', text: 'Explore thousands of anime by genre, season, studio and creator, with schedules for what’s airing now.' },
  { icon: BarChart3, title: 'Track & rate', text: 'Keep your library, tick off episodes, and rate how well each one kept you watching.' },
  { icon: MessagesSquare, title: 'Talk about it', text: 'Write reviews, start discussions, share articles and join communities with other fans.' },
  { icon: Sparkles, title: 'Get excited', text: 'Hype upcoming shows and get told the moment they premiere.' },
];

export default function AboutPage() {
  const me = ABOUT_ME;
  const showMe = me.paragraphs.some((p) => p.trim());

  return (
    <div className={styles.page}>
      <PageHead kicker="About Us" title="Made by fans, for fans" />
      <p className={styles.lead}>
        OTAKUVA is a home for anime fans to track what they watch, rate what they love and find what’s next — and to talk about it with people
        who care just as much. It’s made in India.
      </p>

      <section className={styles.section} aria-labelledby="about-what">
        <p className={styles.kicker}>What OTAKUVA is</p>
        <h2 id="about-what" className={styles.heading}>
          One place for everything anime
        </h2>
        <div className={styles.grid}>
          {WHAT_YOU_CAN_DO.map(({ icon: Icon, title, text }) => (
            <div key={title} className={styles.tile}>
              <span className={styles.tileIcon} aria-hidden="true">
                <Icon size={18} />
              </span>
              <p className={styles.tileTitle}>{title}</p>
              <p className={styles.tileText}>{text}</p>
            </div>
          ))}
        </div>
        <p className={styles.body}>
          OTAKUVA is not a streaming site — we link to official platforms where a show is available. Anime information comes from public databases
          such as AniList and MyAnimeList; see <Link href="/credits">Data credits</Link>.
        </p>
      </section>

      {showMe && (
        <section className={styles.section} aria-labelledby="about-me">
          <p className={styles.kicker}>About me</p>
          <h2 id="about-me" className={styles.heading}>
            The person behind OTAKUVA
          </h2>
          <div className={styles.person}>
            {me.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.photo} alt={me.name || 'Founder'} className={styles.photo} width={148} height={148} />
            )}
            <div className={styles.personText}>
              {me.name && <p className={styles.personName}>{me.name}</p>}
              {me.name && me.role && <p className={styles.personRole}>{me.role}</p>}
              {me.paragraphs
                .filter((p) => p.trim())
                .map((p) => (
                  <p key={p.slice(0, 40)} className={styles.body}>
                    {p}
                  </p>
                ))}
              {me.links.length > 0 && (
                <div className={styles.links}>
                  {me.links.map((l) => (
                    <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className={styles.section} aria-labelledby="about-contact">
        <p className={styles.kicker}>Get in touch</p>
        <h2 id="about-contact" className={styles.heading}>
          Support
        </h2>
        <SupportEmailCard />
        <p className={styles.body}>
          Questions, feedback, a bug or wrong anime details — we’d like to hear it. See <Link href="/support">how support works</Link> (our support
          terms) and the <Link href="/terms">Terms &amp; Conditions</Link> for using OTAKUVA.
        </p>
      </section>
    </div>
  );
}
