'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { User, Mic, Tv } from 'lucide-react';
import styles from '../../upcoming/page.module.css';

export default function CharacterDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [character, setCharacter] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/characters/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setCharacter(data.character);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (slug) load();
  }, [slug]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ color: '#8B8D98', padding: '60px 0', textAlign: 'center' }}>Loading character profile...</div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className={styles.container}>
        <div style={{ color: '#8B8D98', padding: '60px 0', textAlign: 'center' }}>Character profile not found.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {character.imageUrl ? (
            <Image
              src={character.imageUrl}
              alt={character.name}
              width={90}
              height={120}
              style={{ borderRadius: '8px', objectFit: 'cover' }}
              unoptimized
            />
          ) : (
            <div
              style={{
                width: '90px',
                height: '120px',
                borderRadius: '8px',
                backgroundColor: '#181A21',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={36} color="#8B8D98" />
            </div>
          )}
          <div>
            <h1 className={styles.title}>{character.name}</h1>
            {character.nameKanji && (
              <div style={{ fontSize: '1rem', color: '#8B8D98', marginBottom: '6px' }}>{character.nameKanji}</div>
            )}
          </div>
        </div>
        {character.about && <p className={styles.subtitle} style={{ marginTop: '16px' }}>{character.about}</p>}
      </div>

      {character.animeAppearances?.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Tv size={18} color="#5B5FEF" />
            <span>Anime Appearances</span>
            <span className={styles.countBadge}>{character.animeAppearances.length}</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {character.animeAppearances.map((aa: any, idx: number) => (
              <Link
                href={`/anime/${aa.slug || aa.animeId}`}
                key={idx}
                style={{
                  display: 'flex',
                  gap: '12px',
                  backgroundColor: '#14161C',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  padding: '10px',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                {aa.posterImage && (
                  <Image
                    src={aa.posterImage}
                    alt={aa.title}
                    width={45}
                    height={65}
                    style={{ borderRadius: '4px', objectFit: 'cover' }}
                    unoptimized
                  />
                )}
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>{aa.title}</h4>
                  <div style={{ fontSize: '0.75rem', color: '#5B5FEF' }}>{aa.role || 'Main'}</div>
                  {aa.year && <div style={{ fontSize: '0.75rem', color: '#8B8D98' }}>{aa.year}</div>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {character.voiceActors?.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Mic size={18} color="#5B5FEF" />
            <span>Voice Actors</span>
            <span className={styles.countBadge}>{character.voiceActors.length}</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {character.voiceActors.map((va: any, idx: number) => (
              <Link
                href={`/person/${va.personSlug || va.personId}`}
                key={idx}
                style={{
                  display: 'flex',
                  gap: '12px',
                  backgroundColor: '#14161C',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  padding: '8px',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                {va.personImage && (
                  <Image
                    src={va.personImage}
                    alt={va.personName}
                    width={40}
                    height={55}
                    style={{ borderRadius: '4px', objectFit: 'cover' }}
                    unoptimized
                  />
                )}
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>{va.personName}</h4>
                  <div style={{ fontSize: '0.75rem', color: '#8B8D98' }}>{va.language}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
