'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExploreSearch } from './ExploreSearch';

const POPULAR_GENRES = ['Action', 'Romance', 'Comedy', 'Fantasy', 'Slice of Life', 'Mystery', 'Sci-Fi', 'Sports'];

/**
 * The Explore search bar for pages that aren't Explore (Browse, …): same live
 * suggestions and recent searches; Enter or a genre opens Explore with it.
 */
export function CatalogSearchBox() {
  const router = useRouter();
  const [value, setValue] = useState('');
  return (
    <ExploreSearch
      value={value}
      onChange={setValue}
      onCommit={(v) => {
        if (v.trim()) router.push(`/anime?q=${encodeURIComponent(v.trim())}`);
      }}
      genres={POPULAR_GENRES}
      onPickGenre={(g) => router.push(`/anime?genre=${encodeURIComponent(g)}`)}
      total={null}
    />
  );
}
