'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Users2, Search, Award, Sparkles } from 'lucide-react';
import { ScrollReveal } from '../../components/ui/ScrollReveal';
import styles from './creators.module.css';

interface Creator {
  id: string;
  name: string;
  slug: string;
  role: 'Director' | 'Composer' | 'Animator' | 'Writer' | 'Voice Actor' | 'Character Designer';
  bio: string;
  knownFor: string;
  notableWorksCount: number;
}

const CREATORS_LIST: Creator[] = [
  {
    id: 'keiichiro-saito',
    name: 'Keiichiro Saito',
    slug: 'keiichiro-saito',
    role: 'Director',
    bio: 'Acclaimed modern director renowned for cinematic pacing, character intimacy, and masterful action choreography.',
    knownFor: "Frieren: Beyond Journey's End, Bocchi the Rock!",
    notableWorksCount: 6,
  },
  {
    id: 'hayao-miyazaki',
    name: 'Hayao Miyazaki',
    slug: 'hayao-miyazaki',
    role: 'Director',
    bio: 'Co-founder of Studio Ghibli, Oscar-winning visionary, animator, and master storyteller of international acclaim.',
    knownFor: 'Spirited Away, Princess Mononoke, The Boy and the Heron',
    notableWorksCount: 22,
  },
  {
    id: 'hiroyuki-sawano',
    name: 'Hiroyuki Sawano',
    slug: 'hiroyuki-sawano',
    role: 'Composer',
    bio: 'Celebrated composer famous for epic, adrenaline-fueled orchestral and vocal soundtracks across modern anime.',
    knownFor: 'Attack on Titan, Kill la Kill, Solo Leveling, Promare',
    notableWorksCount: 38,
  },
  {
    id: 'makoto-shinkai',
    name: 'Makoto Shinkai',
    slug: 'makoto-shinkai',
    role: 'Director',
    bio: 'Director acclaimed for breathtaking background art, poignant romances, and global blockbuster feature films.',
    knownFor: 'Your Name., Weathering with You, Suzume',
    notableWorksCount: 9,
  },
  {
    id: 'yoko-kanno',
    name: 'Yoko Kanno',
    slug: 'yoko-kanno',
    role: 'Composer',
    bio: 'Legendary composer whose eclectic range spans jazz, blues, classical, and electronic soundscapes.',
    knownFor: 'Cowboy Bebop, Ghost in the Shell: SAC, Wolf’s Rain',
    notableWorksCount: 25,
  },
  {
    id: 'shinichiro-watanabe',
    name: 'Shinichiro Watanabe',
    slug: 'shinichiro-watanabe',
    role: 'Director',
    bio: 'Pioneering director known for seamlessly blending Western music genres with cinematic anime storytelling.',
    knownFor: 'Cowboy Bebop, Samurai Champloo, Space Dandy',
    notableWorksCount: 11,
  },
  {
    id: 'naoko-yamada',
    name: 'Naoko Yamada',
    slug: 'naoko-yamada',
    role: 'Director',
    bio: 'Master of nuanced character body language, delicate emotional depth, and poetic visual framing.',
    knownFor: 'A Silent Voice, Liz and the Blue Bird, K-On!',
    notableWorksCount: 8,
  },
  {
    id: 'kenjiro-tsuda',
    name: 'Kenjiro Tsuda',
    slug: 'kenjiro-tsuda',
    role: 'Voice Actor',
    bio: 'Prominent voice actor celebrated for his charismatic, resonant baritone and versatile dramatic roles.',
    knownFor: 'Jujutsu Kaisen (Nanami), Chainsaw Man (Kishibe), Monster',
    notableWorksCount: 45,
  },
  {
    id: 'tetsuro-araki',
    name: 'Tetsuro Araki',
    slug: 'tetsuro-araki',
    role: 'Director',
    bio: 'High-octane director known for hyper-dynamic camera movements, intense editing, and visceral action.',
    knownFor: 'Death Note, Attack on Titan Season 1–3, Kabaneri',
    notableWorksCount: 14,
  },
];

const ROLES = ['All', 'Director', 'Composer', 'Voice Actor', 'Animator', 'Writer'] as const;

export default function CreatorsPage() {
  const [selectedRole, setSelectedRole] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCreators = useMemo(() => {
    return CREATORS_LIST.filter((creator) => {
      const matchRole = selectedRole === 'All' || creator.role === selectedRole;
      const matchSearch =
        searchQuery.trim() === '' ||
        creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        creator.knownFor.toLowerCase().includes(searchQuery.toLowerCase());
      return matchRole && matchSearch;
    });
  }, [selectedRole, searchQuery]);

  return (
    <div className={styles.page}>
      {/* 1. Hero Header */}
      <div className={styles.hero}>
        <div className={styles.badge}>
          <Users2 size={12} />
          <span>Talent &amp; Cast Intelligence</span>
        </div>
        <h1 className={styles.heroTitle}>Creators &amp; Production Cast</h1>
        <p className={styles.heroSubtitle}>
          Discover the visionary directors, composers, animators, and voice artists who define the artistry of Japanese animation.
        </p>
      </div>

      {/* 2. Filter & Search Bar */}
      <div className={styles.filterBar}>
        <div className={styles.roleTabs}>
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              className={`${styles.roleTab} ${selectedRole === role ? styles.roleTabActive : ''}`}
              onClick={() => setSelectedRole(role)}
            >
              {role}
            </button>
          ))}
        </div>

        <div className={styles.searchBox}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search creator by name or anime..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 3. Creators Grid */}
      <ScrollReveal>
        <div className={styles.creatorsGrid}>
          {filteredCreators.map((creator) => (
            <Link
              key={creator.id}
              href={`/person/${creator.slug}`}
              className={styles.creatorCard}
            >
              <div className={styles.avatarWrap}>
                <span>{creator.name.slice(0, 2).toUpperCase()}</span>
              </div>

              <div className={styles.creatorInfo}>
                <h2 className={styles.creatorName}>{creator.name}</h2>
                <span className={styles.creatorRole}>{creator.role}</span>
                <p className={styles.creatorBio}>{creator.bio}</p>
                <div className={styles.knownFor}>
                  <span>Known For: </span>
                  <strong style={{ color: 'var(--text-primary)' }}>{creator.knownFor}</strong>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </ScrollReveal>
    </div>
  );
}
