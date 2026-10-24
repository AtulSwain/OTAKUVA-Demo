import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Clapperboard, ArrowRight } from 'lucide-react';
import { ScrollReveal } from '../../components/ui/ScrollReveal';
import { prisma } from '../../lib/prisma';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './production.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Anime Production | OTAKUVA' };

/**
 * The producers with the most titles in the catalog, from the Producer /
 * AnimeProducer tables. This list used to be hardcoded — names, "roles",
 * founding years, partner-studio counts and marketing copy typed into the
 * page — rather than read from the data the rest of the site uses.
 */
async function getTopProducers() {
  const producers = await prisma.producer.findMany({
    where: { slug: { not: null } },
    orderBy: { animeProducers: { _count: 'desc' } },
    take: 24,
    select: {
      name: true,
      slug: true,
      _count: { select: { animeProducers: true } },
      animeProducers: {
        where: { anime: { status: { not: 'MERGED' }, isAdult: false } },
        orderBy: { anime: { score: { sort: 'desc', nulls: 'last' } } },
        take: 3,
        select: { anime: { select: { canonicalTitle: true, slug: true } } },
      },
    },
  });
  return producers
    .filter((p) => p._count.animeProducers > 0)
    .map((p) => ({
      name: sanitizePublicEntityName(p.name),
      slug: p.slug as string,
      count: p._count.animeProducers,
      notable: p.animeProducers.map((ap) => ({ title: sanitizePublicEntityName(ap.anime.canonicalTitle), slug: ap.anime.slug })),
    }));
}

export default async function ProductionPage() {
  const producers = await getTopProducers();

  return (
    <div className={styles.page}>
      {/* 1. Header Hero */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <Clapperboard size={12} />
            <span>How anime gets made</span>
          </div>
          <h1 className={styles.heroTitle}>Anime Production &amp; Committees</h1>
          <p className={styles.heroSubtitle}>
            Publishers, planning companies, production committees and animation studios each play a part. Here&apos;s how they fit together, and the producers behind the most titles in the catalog.
          </p>
        </div>
      </div>

      {/* 2. Committee Flow Explainer */}
      <ScrollReveal>
        <div className={styles.flowSection}>
          <h2 className={styles.flowTitle}>How an Anime is Produced: The Committee System</h2>
          <div className={styles.flowGrid}>
            <div className={styles.flowCard}>
              <span className={styles.flowStepNum}>STEP 01</span>
              <h3 className={styles.flowStepTitle}>Planning &amp; IP Source</h3>
              <p className={styles.flowStepDesc}>
                Publishers (manga/light novel) or creators propose an adaptation and form a Production Committee to finance the budget.
              </p>
            </div>

            <div className={styles.flowCard}>
              <span className={styles.flowStepNum}>STEP 02</span>
              <h3 className={styles.flowStepTitle}>Studio Commission</h3>
              <p className={styles.flowStepDesc}>
                The committee contracts an animation studio (e.g. Madhouse, MAPPA, Ufotable) and appoints the Director &amp; Series Composer.
              </p>
            </div>

            <div className={styles.flowCard}>
              <span className={styles.flowStepNum}>STEP 03</span>
              <h3 className={styles.flowStepTitle}>Animation Pipeline</h3>
              <p className={styles.flowStepDesc}>
                Key animators, background artists, color designers, and sound directors produce episodes under production supervision.
              </p>
            </div>

            <div className={styles.flowCard}>
              <span className={styles.flowStepNum}>STEP 04</span>
              <h3 className={styles.flowStepTitle}>Distribution &amp; Music</h3>
              <p className={styles.flowStepDesc}>
                Broadcast networks, streaming licensors, and record labels distribute the finished master worldwide.
              </p>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* 3. Major Production Companies */}
      <ScrollReveal delayMs={50}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Producers in the catalog</h2>
            <p className={styles.sectionNote}>Ranked by how many catalogued titles credit them.</p>
          </div>

          {producers.length === 0 ? (
            <p className={styles.sectionNote}>No producers have been recorded in the catalog yet.</p>
          ) : (
            <div className={styles.companyGrid}>
              {producers.map((company) => (
                <Link key={company.slug} href={`/producer/${company.slug}`} className={styles.companyCard}>
                  <div className={styles.cardTop}>
                    <h3 className={styles.companyName}>{company.name}</h3>
                    <ArrowRight size={16} aria-hidden="true" className={styles.cardArrow} />
                  </div>
                  {company.notable.length > 0 && (
                    <p className={styles.companyDesc}>{company.notable.map((n) => n.title).join(' · ')}</p>
                  )}
                  <div className={styles.cardStats}>
                    <span>
                      {company.count.toLocaleString('en-US')} {company.count === 1 ? 'title' : 'titles'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </ScrollReveal>
    </div>
  );
}
