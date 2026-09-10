import React, { Suspense } from 'react';
import { Metadata } from 'next';
import { AnimeLibraryView } from '../../components/anime/AnimeLibraryView';

export const metadata: Metadata = {
  title: 'Anime Library | OTAKUVA',
  description: 'Explore the complete OTAKUVA anime catalog, genres, studios, and rankings.',
};

export default function AnimePage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#71717A' }}>
          Loading OTAKUVA Anime Catalog...
        </div>
      }
    >
      <AnimeLibraryView />
    </Suspense>
  );
}
