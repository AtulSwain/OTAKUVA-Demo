'use client';

import React, { Suspense } from 'react';
import { ImageList, type ImageListConfig } from '../ImageList';

type Row = { id: string; slug: string | null; name: string; imageUrl: string | null; anime: string | null };

const cfg: ImageListConfig<Row> = {
  kicker: 'People',
  title: 'Characters',
  endpoint: '/api/control/characters',
  listKey: 'characters',
  imageKey: 'imageUrl',
  missingValue: 'image',
  missingLabel: 'No image',
  kind: 'character',
  shape: 'poster',
  searchPlaceholder: 'Search characters',
  href: (r) => (r.slug ? `/character/${r.slug}` : null),
  subtitle: (r) => r.anime || '',
};

export default function ControlCharactersPage() {
  return (
    <Suspense fallback={null}>
      <ImageList cfg={cfg} />
    </Suspense>
  );
}
