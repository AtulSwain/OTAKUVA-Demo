/**
 * Danbooru & Anime Artist Wiki Provider
 * Fetches artist information, biographies, aliases, external links, and creator commentary.
 */

export interface DanbooruArtistInfo {
  name: string;
  otherNames: string[];
  urls: string[];
  wikiBody: string | null;
  summary: string | null;
  source: 'danbooru' | 'booru' | 'wikipedia' | 'fallback';
}

function cleanWikiText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\[\[(.*?)\]\]/g, '$1') // remove [[wiki link]] syntax
    .replace(/h3\.\s+/g, '') // remove textile headers
    .replace(/h2\.\s+/g, '')
    .replace(/h1\.\s+/g, '')
    .replace(/"(.*?)\":(https?:\/\/[^\s]+)/g, '$1 ($2)') // textile link syntax
    .replace(/\*([^*]+)\*/g, '$1') // bold/italics
    .replace(/[\r\n]{3,}/g, '\n\n')
    .trim();
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export async function fetchDanbooruArtistAbout(artistName: string): Promise<DanbooruArtistInfo | null> {
  if (!artistName || artistName.trim().length === 0) return null;

  const rawName = artistName.trim();
  const normalizedUnderscore = rawName.toLowerCase().replace(/\s+/g, '_');
  const normalizedReversed = rawName.split(' ').reverse().join('_').toLowerCase();

  // 1. Try Danbooru Wiki Pages API
  for (const query of [normalizedUnderscore, normalizedReversed]) {
    try {
      const wikiUrl = `https://danbooru.donmai.us/wiki_pages.json?search[title]=${encodeURIComponent(query)}`;
      const res = await fetch(wikiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ANILOG/1.0',
          'Accept': 'application/json',
        },
        next: { revalidate: 86400 },
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0 && data[0].body) {
          const page = data[0];
          const cleaned = cleanWikiText(page.body);
          const otherNames = Array.isArray(page.other_names) ? page.other_names : [];

          return {
            name: page.title || artistName,
            otherNames,
            urls: [],
            wikiBody: cleaned,
            summary: cleaned.length > 300 ? cleaned.slice(0, 300) + '...' : cleaned,
            source: 'danbooru',
          };
        }
      }
    } catch (err) {
      // Continue
    }
  }

  // 2. Try Yande.re / Konachan Booru API
  for (const booruHost of ['yande.re', 'konachan.net']) {
    for (const query of [normalizedUnderscore, normalizedReversed]) {
      try {
        const url = `https://${booruHost}/wiki.json?query=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 86400 },
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0 && data[0].body) {
            const page = data[0];
            const cleaned = cleanWikiText(page.body);
            return {
              name: page.title || artistName,
              otherNames: [],
              urls: [],
              wikiBody: cleaned,
              summary: cleaned.length > 300 ? cleaned.slice(0, 300) + '...' : cleaned,
              source: 'booru',
            };
          }
        }
      } catch (err) {
        // Continue
      }
    }
  }

  // 3. Encyclopedic Artist/Studio fallback (Wikipedia REST API)
  const titleCased = toTitleCase(rawName);
  const candidates = [
    titleCased,
    `${titleCased} (studio)`,
    `${titleCased} (company)`,
    `${titleCased} (animator)`,
    `${titleCased} (director)`,
    `${titleCased} (musician)`,
  ];

  for (const query of candidates) {
    try {
      const wikiSummaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/\s+/g, '_'))}`;
      const res = await fetch(wikiSummaryUrl, {
        headers: {
          'User-Agent': 'ANILOG/1.0 (Anime Tracking & Discovery Platform)',
          'Accept': 'application/json',
        },
        next: { revalidate: 86400 },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.extract && data.type !== 'disambiguation') {
          return {
            name: data.title || artistName,
            otherNames: data.description ? [data.description] : [],
            urls: data.content_urls?.desktop?.page ? [data.content_urls.desktop.page] : [],
            wikiBody: data.extract,
            summary: data.extract.length > 300 ? data.extract.slice(0, 300) + '...' : data.extract,
            source: 'wikipedia',
          };
        }
      }
    } catch (err) {
      // Non-blocking
    }
  }

  return null;
}
