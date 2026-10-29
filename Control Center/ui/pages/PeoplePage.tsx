'use client';

import React, { Suspense } from 'react';
import { ImageList, type ImageListConfig } from '../ImageList';

type Row = { id: string; slug: string | null; name: string; nativeName: string | null; imageUrl: string | null; credits: number; voiceRoles: number };

const cfg: ImageListConfig<Row> = {
  kicker: 'People',
  title: 'Creators & cast',
  endpoint: '/api/control/people',
  listKey: 'people',
  imageKey: 'imageUrl',
  missingValue: 'photo',
  missingLabel: 'No photo',
  kind: 'photo',
  shape: 'poster',
  searchPlaceholder: 'Search people',
  href: (r) => (r.slug ? `/person/${r.slug}` : null),
  subtitle: (r) => [r.nativeName, r.credits ? `${r.credits} credits` : null, r.voiceRoles ? `${r.voiceRoles} voice roles` : null].filter(Boolean).join(' · '),
};

export default function ControlPeoplePage() {
  return (
    <Suspense fallback={null}>
      <ImageList cfg={cfg} />
    </Suspense>
  );
}
