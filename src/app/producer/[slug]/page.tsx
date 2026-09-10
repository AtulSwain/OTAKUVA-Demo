'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Film, Globe } from 'lucide-react';
import { AnimeCard } from '../../../components/ui/AnimeCard';
import { AnimeGrid } from '../../../components/ui/AnimeGrid';
import styles from '../../upcoming/page.module.css';

export default function ProducerDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [producer, setProducer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/producers/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setProducer(data.producer);
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
        <div style={{ color: '#8B8D98', padding: '60px 0', textAlign: 'center' }}>Loading producer catalog...</div>
      </div>
    );
  }

  if (!producer) {
    return (
      <div className={styles.container}>
        <div style={{ color: '#8B8D98', padding: '60px 0', textAlign: 'center' }}>Producer not found.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '8px',
              backgroundColor: '#181A21',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <Film size={28} color="#5B5FEF" />
          </div>
          <div>
            <h1 className={styles.title}>{producer.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.875rem', color: '#8B8D98' }}>
              <span>{producer.totalWorks} Associated Works</span>
              {producer.website && (
                <a
                  href={producer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#5B5FEF', textDecoration: 'none' }}
                >
                  <Globe size={13} />
                  <span>Official Website</span>
                </a>
              )}
            </div>
          </div>
        </div>
        {producer.about && (
          <div style={{ marginTop: '16px', lineHeight: 1.6, color: '#D1D5DB', fontSize: '0.9375rem', backgroundColor: '#14161C', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <p style={{ whiteSpace: 'pre-wrap' }}>{producer.about}</p>
          </div>
        )}
      </div>

      <AnimeGrid>
        {producer.animes.map((a: any) => (
          <AnimeCard key={a.id} anime={a} />
        ))}
      </AnimeGrid>
    </div>
  );
}
