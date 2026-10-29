'use client';

import React, { Suspense } from 'react';
import { ImageList, type ImageListConfig } from '../ImageList';

type Row = { id: string; slug: string | null; name: string; logoUrl: string | null; foundedYear: number | null; works: number };

const cfg: ImageListConfig<Row> = {
  kicker: 'Production',
  title: 'Studios',
  endpoint: '/api/control/studios',
  listKey: 'studios',
  imageKey: 'logoUrl',
  missingValue: 'logo',
  missingLabel: 'No logo',
  kind: 'logo',
  shape: 'square',
  searchPlaceholder: 'Search studios',
  href: (r) => `/studio/${r.slug || r.id}`,
  subtitle: (r) => [r.foundedYear ? `Est. ${r.foundedYear}` : null, `${r.works} works`].filter(Boolean).join(' · '),
};

export default function ControlStudiosPage() {
  return (
    <Suspense fallback={null}>
      <ImageList cfg={cfg} />
    </Suspense>
  );
}
