'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { User, Mic, Clapperboard } from 'lucide-react';
import styles from '../../upcoming/page.module.css';

export default function PersonDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [person, setPerson] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/people/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setPerson(data.person);
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
        <div style={{ color: '#8B8D98', padding: '60px 0', textAlign: 'center' }}>Loading person profile...</div>
      </div>
    );
  }

  if (!person) {
    return (
      <div className={styles.container}>
        <div style={{ color: '#8B8D98', padding: '60px 0', textAlign: 'center' }}>Person profile not found.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {person.imageUrl ? (
            <Image
              src={person.imageUrl}
              alt={person.name}
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
            <h1 className={styles.title}>{person.name}</h1>
            {person.nameKanji && (
              <div style={{ fontSize: '1rem', color: '#8B8D98', marginBottom: '6px' }}>{person.nameKanji}</div>
            )}
            {person.birthday && (
              <div style={{ fontSize: '0.875rem', color: '#8B8D98' }}>Birthday: {person.birthday}</div>
            )}
            {person.artistWiki?.otherNames?.length > 0 && (
              <div style={{ fontSize: '0.8125rem', color: '#8B8D98', marginTop: '4px' }}>
                <span style={{ color: '#F5F5F7' }}>Aliases: </span>
                {person.artistWiki.otherNames.slice(0, 4).join(', ')}
              </div>
            )}
          </div>
        </div>
        {person.biography && (
          <div style={{ marginTop: '16px', lineHeight: 1.6, color: '#F5F5F7', fontSize: '0.9375rem', backgroundColor: '#14161C', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h4 style={{ fontSize: '0.875rem', color: '#5B5FEF', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              About the Artist / Creator
            </h4>
            <p style={{ whiteSpace: 'pre-wrap', color: '#D1D5DB' }}>{person.biography}</p>
          </div>
        )}
      </div>

      {person.staffCredits?.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Clapperboard size={18} color="#5B5FEF" />
            <span>Staff Credits</span>
            <span className={styles.countBadge}>{person.staffCredits.length}</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {person.staffCredits.map((sc: any, idx: number) => (
              <Link
                href={`/anime/${sc.slug || sc.animeId}`}
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
                {sc.posterImage && (
                  <Image
                    src={sc.posterImage}
                    alt={sc.title}
                    width={45}
                    height={65}
                    style={{ borderRadius: '4px', objectFit: 'cover' }}
                    unoptimized
                  />
                )}
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '4px' }}>{sc.title}</h4>
                  <div style={{ fontSize: '0.75rem', color: '#5B5FEF' }}>{sc.role}</div>
                  {sc.year && <div style={{ fontSize: '0.75rem', color: '#8B8D98' }}>{sc.year}</div>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {person.voiceRoles?.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Mic size={18} color="#5B5FEF" />
            <span>Voice Acting Roles</span>
            <span className={styles.countBadge}>{person.voiceRoles.length}</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {person.voiceRoles.map((vr: any, idx: number) => (
              <Link
                href={`/character/${vr.characterSlug || vr.characterId}`}
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
                {vr.characterImage && (
                  <Image
                    src={vr.characterImage}
                    alt={vr.characterName}
                    width={40}
                    height={55}
                    style={{ borderRadius: '4px', objectFit: 'cover' }}
                    unoptimized
                  />
                )}
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>{vr.characterName}</h4>
                  <div style={{ fontSize: '0.75rem', color: '#8B8D98' }}>{vr.language}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
