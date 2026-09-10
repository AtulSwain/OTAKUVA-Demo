/**
 * OTAKUVA CONTENT & CULTURE ENGINE
 * Manages studio knowledge, historical eras, region-aware streaming availability, and news.
 */

import { prisma } from '../../prisma';

export interface StreamingAvailabilityInput {
  animeId: string;
  provider: string; // "Crunchyroll", "Netflix", "Hulu", "HIDIVE", "Disney+", "Amazon Prime"
  region?: string;
  availabilityType?: string;
  url?: string;
}

export const ANIME_HISTORICAL_ERAS = [
  {
    id: 'era_early',
    name: 'Origins & Early Animation (1917–1950s)',
    description: 'Pioneering experiments by Junichi Kouchi and Osamu Tezuka laying the visual foundations of Japanese animation.',
    landmarkTitles: ['Astro Boy', 'Hakujaden (The Tale of the White Serpent)'],
  },
  {
    id: 'era_tv',
    name: 'Television & Golden Age Expansion (1960s–1970s)',
    description: 'The rise of episodic TV broadcasting, giant mecha genre inception, and space operas.',
    landmarkTitles: ['Speed Racer', 'Mobile Suit Gundam', 'Space Battleship Yamato'],
  },
  {
    id: 'era_80s',
    name: 'The 1980s OVA & Cinematic Boom',
    description: 'The era of lavish OVA animation budgets, cyberpunk masterpieces, and Studio Ghibli formation.',
    landmarkTitles: ['Akira', 'My Neighbor Totoro', 'Nausicaä of the Valley of the Wind'],
  },
  {
    id: 'era_90s',
    name: 'The 1990s Global Renaissance',
    description: 'Deconstructive storytelling, psychological depth, and explosive worldwide television syndication.',
    landmarkTitles: ['Neon Genesis Evangelion', 'Cowboy Bebop', 'Sailor Moon', 'Dragon Ball Z'],
  },
  {
    id: 'era_2000s',
    name: 'The 2000s Digital Transformation',
    description: 'Transition to digital cel coloring, modern light novel adaptations, and prestige psychological thrillers.',
    landmarkTitles: ['Death Note', 'Monster', 'Code Geass', 'Spirited Away'],
  },
  {
    id: 'era_modern',
    name: 'The Streaming Era & Modern Powerhouses (2010s–Present)',
    description: 'Global simultaneous streaming, cinematic box office records, and digital sakuga animation peaks.',
    landmarkTitles: ['Attack on Titan', 'Demon Slayer: Kimetsu no Yaiba', 'Jujutsu Kaisen', 'Chainsaw Man'],
  },
];

/**
 * Retrieves streaming availability for an anime
 */
export async function getStreamingAvailability(animeId: string, region = 'GLOBAL') {
  const availability = await prisma.streamingAvailability.findMany({
    where: {
      animeId,
      OR: [{ region }, { region: 'GLOBAL' }],
    },
    orderBy: { provider: 'asc' },
  });

  return availability;
}

/**
 * Sets or updates streaming availability
 */
export async function setStreamingAvailability(input: StreamingAvailabilityInput) {
  const { animeId, provider, region = 'GLOBAL', availabilityType = 'SUBSCRIPTION', url } = input;

  return prisma.streamingAvailability.create({
    data: {
      animeId,
      provider,
      region,
      availabilityType,
      url,
      source: 'OFFICIAL',
    },
  });
}
