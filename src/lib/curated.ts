/**
 * Editorial lists — edit this file by hand.
 *
 * Each entry names a title and optionally a format / first-aired year to
 * disambiguate. `search` is matched against every stored title of an anime
 * (English, romaji, synonyms). Entries that are not in the catalog yet are
 * imported by `npx tsx scripts/resolve_curated.ts`; until then they are
 * skipped, never faked.
 */

export interface CuratedEntry {
  search: string;
  /** Matches Anime.type: TV, Movie, OVA, ONA, Special */
  format?: string;
  /** First-aired year, used to tell seasons/remakes apart. */
  year?: number;
  /** Optional one-sentence editor's note (Otakuva Choice only). */
  note?: string;
}

export interface AwardEntry extends CuratedEntry {
  award: string;
  /** Ceremony year (the award honours the previous year's anime). */
  ceremonyYear: number;
}

// SAMPLE PICKS — replace with the real Otakuva Choice list. Order = rank.
export const OTAKUVA_CHOICE: CuratedEntry[] = [
  { search: 'Cowboy Bebop', format: 'TV', year: 1998 },
  { search: 'Steins;Gate', format: 'TV', year: 2011 },
  { search: 'Fullmetal Alchemist: Brotherhood', format: 'TV', year: 2009 },
  { search: 'Death Note', format: 'TV', year: 2006 },
  { search: 'Spirited Away', format: 'Movie', year: 2001 },
  { search: 'Neon Genesis Evangelion', format: 'TV', year: 1995 },
  { search: 'Hunter x Hunter', format: 'TV', year: 2011 },
  { search: "Frieren: Beyond Journey's End", format: 'TV', year: 2023 },
  { search: 'Code Geass: Lelouch of the Rebellion', format: 'TV', year: 2006 },
  { search: 'Mob Psycho 100', format: 'TV', year: 2016 },
];

// Crunchyroll Anime Awards, "Anime of the Year". Newest first. Only results
// verified from public sources — do not add other years without verifying.
export const AWARDS: AwardEntry[] = [
  { search: 'My Hero Academia Final Season', award: 'Anime of the Year', ceremonyYear: 2026 },
  { search: 'Solo Leveling', format: 'TV', year: 2024, award: 'Anime of the Year', ceremonyYear: 2025 },
  { search: 'Cyberpunk: Edgerunners', award: 'Anime of the Year', ceremonyYear: 2023 },
  { search: 'Attack on Titan Final Season', format: 'TV', year: 2021, award: 'Anime of the Year', ceremonyYear: 2022 },
  { search: 'Devilman Crybaby', award: 'Anime of the Year', ceremonyYear: 2019 },
  { search: 'Yuri!!! on Ice', award: 'Anime of the Year', ceremonyYear: 2017 },
];
