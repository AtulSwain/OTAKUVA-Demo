'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './monetization.module.css';
type Ad = { id: string; title: string; imageUrl: string | null; videoUrl: string | null; clickUrl: string; altText: string | null };
export function SponsorAdRail() { const [ads, setAds] = useState<Ad[]>([]); useEffect(() => { fetch('/api/sponsor-ads').then((r) => r.ok ? r.json() : null).then((d) => setAds(d?.ads || [])).catch(() => {}); }, []); if (!ads.length) return null; return <section className={styles.adSection} aria-label="Sponsored"><div className={styles.adLabel}>Sponsored</div><div className={styles.adGrid}>{ads.map((ad) => <Link href={ad.clickUrl} target="_blank" rel="sponsored noopener noreferrer" key={ad.id} className={styles.adCard}>{ad.videoUrl ? <video src={ad.videoUrl} autoPlay muted loop playsInline aria-label={ad.altText || ad.title} /> : ad.imageUrl ? <img src={ad.imageUrl} alt={ad.altText || ad.title} /> : null}<span>{ad.title}</span></Link>)}</div></section>; }
