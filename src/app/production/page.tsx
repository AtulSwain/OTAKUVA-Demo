'use client';

import React from 'react';
import Link from 'next/link';
import { Clapperboard, Layers, Building2, Users, ArrowRight, Film, Award } from 'lucide-react';
import { ScrollReveal } from '../../components/ui/ScrollReveal';
import styles from './production.module.css';

interface ProductionCompany {
  id: string;
  name: string;
  slug: string;
  role: string;
  description: string;
  notableWorks: string[];
  partnerStudios: string[];
  foundedYear: number;
}

const PRODUCTION_COMPANIES: ProductionCompany[] = [
  {
    id: 'toho-animation',
    name: 'TOHO animation',
    slug: 'toho-animation',
    role: 'Production & Planning',
    description: 'The animation production branch of Toho Co., Ltd., funding and producing flagship modern masterpieces.',
    notableWorks: ["Frieren: Beyond Journey's End", 'Jujutsu Kaisen', 'My Hero Academia', 'Spy × Family'],
    partnerStudios: ['Madhouse', 'MAPPA', 'Bones', 'CloverWorks / Wit Studio'],
    foundedYear: 2012,
  },
  {
    id: 'aniplex',
    name: 'Aniplex',
    slug: 'aniplex',
    role: 'Planning & Distribution',
    description: 'Sony Music Entertainment subsidiary specializing in high-tier anime production, music, and distribution worldwide.',
    notableWorks: ['Demon Slayer: Kimetsu no Yaiba', 'Fate/stay night: Heaven’s Feel', 'Bocchi the Rock!', 'Sword Art Online'],
    partnerStudios: ['Ufotable', 'CloverWorks', 'A-1 Pictures'],
    foundedYear: 1995,
  },
  {
    id: 'kadokawa',
    name: 'Kadokawa Corporation',
    slug: 'kadokawa',
    role: 'Publisher & Committee Lead',
    description: 'Major Japanese publishing conglomerate spearheading light novel and manga adaptations into anime productions.',
    notableWorks: ['Re:Zero', 'The Eminence in Shadow', 'Delicious in Dungeon', 'Konosuba'],
    partnerStudios: ['White Fox', 'Nexus', 'Trigger', 'Studio Deen'],
    foundedYear: 1945,
  },
  {
    id: 'bandai-namco-filmworks',
    name: 'Bandai Namco Filmworks',
    slug: 'bandai-namco-filmworks',
    role: 'Production & IP Management',
    description: 'Consolidated entity encompassing Sunrise, Bandai Visual, and Emotion managing iconic sci-fi and franchise IPs.',
    notableWorks: ['Mobile Suit Gundam', 'Cowboy Bebop', 'Code Geass', 'Love Live!'],
    partnerStudios: ['Sunrise', 'Actas', 'Bandai Namco Pictures'],
    foundedYear: 1972,
  },
  {
    id: 'twin-engine',
    name: 'Twin Engine',
    slug: 'twin-engine',
    role: 'Planning & Producer Network',
    description: 'Producer-led production company fostering innovative anime with dedicated boutique animation studios.',
    notableWorks: ['Vinland Saga', 'Dororo', 'Mononoke', 'Burn the Witch'],
    partnerStudios: ['MAPPA', 'Wit Studio', 'Studio Colorido', 'Kafka'],
    foundedYear: 2014,
  },
  {
    id: 'pony-canyon',
    name: 'Pony Canyon',
    slug: 'pony-canyon',
    role: 'Music & Production',
    description: 'Major Japanese entertainment company producing music and investing in landmark anime committees.',
    notableWorks: ['Attack on Titan', 'Sound! Euphonium', 'Free!', 'Clannad'],
    partnerStudios: ['Wit Studio', 'Kyoto Animation', 'MAPPA'],
    foundedYear: 1966,
  },
];

export default function ProductionPage() {
  return (
    <div className={styles.page}>
      {/* 1. Header Hero */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            <Clapperboard size={12} />
            <span>Anime Industry Intelligence</span>
          </div>
          <h1 className={styles.heroTitle}>Anime Production &amp; Committees</h1>
          <p className={styles.heroSubtitle}>
            Uncover the real architecture of anime creation. Explore how planning companies, publishers, production committees, and animation studios collaborate to bring projects to life.
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
            <h2 className={styles.sectionTitle}>Key Production Companies &amp; Planners</h2>
          </div>

          <div className={styles.companyGrid}>
            {PRODUCTION_COMPANIES.map((company) => (
              <div key={company.id} className={styles.companyCard}>
                <div className={styles.cardTop}>
                  <h3 className={styles.companyName}>{company.name}</h3>
                  <span className={styles.companyRole}>{company.role}</span>
                </div>

                <p className={styles.companyDesc}>{company.description}</p>

                <div className={styles.cardStats}>
                  <span>Est. {company.foundedYear}</span>
                  <span>·</span>
                  <span>{company.partnerStudios.length} Partner Studios</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
}
