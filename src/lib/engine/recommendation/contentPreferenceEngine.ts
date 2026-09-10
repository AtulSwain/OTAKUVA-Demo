/**
 * OTAKUVA ENGINE — PHASE 10.3
 * GENRE, THEME & CONTENT PREFERENCE ENGINE
 * 
 * Machine-readable feature profiles and affinity scoring:
 * - Multi-genre normalized distribution
 * - Theme propagation & adjacent genre discovery mapping
 * - Hybrid Anime Feature Profiles (Structured Metadata + Quality + Aspects + Momentum)
 * - Fine-grained user-to-anime affinity calculations
 * - Controlled exploration & anti-filter-bubble mechanics
 */

import { prisma } from '../../prisma';
import { UserTasteProfileResult } from '../taste/tasteEngine';

export interface AnimeFeatureProfile {
  animeId: string;
  canonicalTitle: string;
  slug: string;
  format: string | null;
  episodes: number | null;
  year: number | null;
  season: string | null;
  genres: string[];
  themes: string[];
  studios: string[];
  directors: string[];
  bayesianScore: number;
  ratingCount: number;
  momentumScore: number;
  aspectScores: {
    story?: number;
    animation?: number;
    characters?: number;
    music?: number;
    pacing?: number;
    worldBuilding?: number;
  };
}

export interface UserAnimeAffinityResult {
  animeId: string;
  overallAffinity: number; // 0.0 to 1.0
  genreAffinity: number;
  themeAffinity: number;
  studioAffinity: number;
  aspectAffinity: number;
  formatAffinity: number;
  penalty: number;
  primaryMatchReason: string;
  reasons: string[];
  isExplorationCandidate: boolean;
}

// Adjacent genre map for controlled exploration & discovery
export const ADJACENT_GENRES: Record<string, string[]> = {
  Psychological: ['Mystery', 'Thriller', 'Horror', 'Supernatural', 'Sci-Fi'],
  Mystery: ['Psychological', 'Thriller', 'Detective', 'Supernatural'],
  Thriller: ['Psychological', 'Mystery', 'Action', 'Crime'],
  Action: ['Adventure', 'Fantasy', 'Sci-Fi', 'Supernatural', 'Martial Arts'],
  Adventure: ['Action', 'Fantasy', 'Sci-Fi'],
  Fantasy: ['Action', 'Adventure', 'Dark Fantasy', 'Magic', 'Isekai'],
  SciFi: ['Mecha', 'Space', 'Cyberpunk', 'Psychological', 'Action'],
  'Slice of Life': ['Comedy', 'Drama', 'Iyashikei', 'School'],
  Romance: ['Drama', 'Slice of Life', 'Comedy', 'Shoujo'],
  Drama: ['Romance', 'Slice of Life', 'Psychological', 'Historical'],
  Comedy: ['Slice of Life', 'Parody', 'Romance'],
};

export class ContentPreferenceEngine {
  /**
   * Constructs an AnimeFeatureProfile from relational database records
   */
  extractAnimeFeatures(anime: any): AnimeFeatureProfile {
    const genres = (anime.animeGenres || []).map((g: any) => g.genre?.name || g.name).filter(Boolean);
    const themes = (anime.animeThemes || []).map((t: any) => t.theme?.name || t.name).filter(Boolean);
    const studios = (anime.animeStudios || []).map((s: any) => s.studio?.name || s.name).filter(Boolean);
    const directors = (anime.staff || [])
      .filter((st: any) => st.role?.toLowerCase().includes('director'))
      .map((st: any) => st.person?.name)
      .filter(Boolean);

    const bayesianScore = anime.ratingAggregate?.bayesianScore || anime.score || 7.0;
    const ratingCount = anime.ratingAggregate?.ratingCount || 0;
    const momentumScore = anime.trendMetric?.momentumScore || 0.0;

    const co = anime.communityOpinion || {};
    const aspectScores: AnimeFeatureProfile['aspectScores'] = {};
    if (co.storyScore) aspectScores.story = co.storyScore;
    if (co.animationScore) aspectScores.animation = co.animationScore;
    if (co.charactersScore) aspectScores.characters = co.charactersScore;
    if (co.musicScore) aspectScores.music = co.musicScore;
    if (co.pacingScore) aspectScores.pacing = co.pacingScore;
    if (co.worldBuildingScore) aspectScores.worldBuilding = co.worldBuildingScore;

    return {
      animeId: anime.id,
      canonicalTitle: anime.canonicalTitle,
      slug: anime.slug,
      format: anime.type || null,
      episodes: anime.episodes || null,
      year: anime.year || null,
      season: anime.season || null,
      genres,
      themes,
      studios,
      directors,
      bayesianScore,
      ratingCount,
      momentumScore,
      aspectScores,
    };
  }

  /**
   * Calculates detailed multi-signal user-to-anime affinity
   */
  calculateAffinity(taste: UserTasteProfileResult, anime: AnimeFeatureProfile): UserAnimeAffinityResult {
    const reasons: string[] = [];
    let genreScore = 0;
    let themeScore = 0;
    let studioScore = 0;
    let aspectScore = 0;
    let formatScore = 0;
    let penalty = 0;

    let matchedGenre = '';
    let matchedStudio = '';
    let isExplorationCandidate = false;

    // 1. Genre Affinity (Multi-genre normalized contribution)
    if (anime.genres.length > 0) {
      let positiveSum = 0;
      let negativeSum = 0;

      for (const g of anime.genres) {
        const sig = taste.genres[g];
        if (sig) {
          if (sig.score > 0) {
            positiveSum += sig.score;
            if (sig.score > genreScore) {
              genreScore = sig.score;
              matchedGenre = g;
            }
          } else if (sig.score < -0.2) {
            negativeSum += Math.abs(sig.score);
          }
        }
      }

      // Proportional distribution
      const normFactor = Math.sqrt(anime.genres.length);
      genreScore = Math.min(1.0, (positiveSum * 1.2) / normFactor);
      penalty += (negativeSum * 1.5) / normFactor;

      if (matchedGenre && genreScore > 0.35) {
        reasons.push(`Matches your preference for ${matchedGenre}`);
      }

      // Check adjacent genres for exploration
      if (genreScore < 0.2 && taste.topGenres.length > 0) {
        const topPrimary = taste.topGenres[0];
        const adj = ADJACENT_GENRES[topPrimary] || [];
        if (anime.genres.some((g) => adj.includes(g))) {
          isExplorationCandidate = true;
          reasons.push(`Exploration: Adjacent to your interest in ${topPrimary}`);
        }
      }
    }

    // 2. Theme Affinity
    if (anime.themes.length > 0) {
      for (const t of anime.themes) {
        const sig = taste.themes[t];
        if (sig && sig.score > themeScore) {
          themeScore = sig.score;
        }
      }
    }

    // 3. Studio Affinity
    if (anime.studios.length > 0) {
      for (const s of anime.studios) {
        const sig = taste.studios[s];
        if (sig && sig.score > studioScore) {
          studioScore = sig.score;
          matchedStudio = s;
        }
      }
      if (studioScore > 0.4 && matchedStudio) {
        reasons.push(`From Studio ${matchedStudio}, which you enjoy`);
      }
    }

    // 4. Aspect Sentiments
    if (taste.aspects.STORY?.score && taste.aspects.STORY.score > 0.3 && (anime.aspectScores.story || 0) >= 8.0) {
      aspectScore += 0.4;
      reasons.push('Praised for brilliant storytelling');
    }
    if (taste.aspects.CHARACTERS?.score && taste.aspects.CHARACTERS.score > 0.3 && (anime.aspectScores.characters || 0) >= 8.0) {
      aspectScore += 0.4;
    }
    if (taste.aspects.PACING?.score && taste.aspects.PACING.score < -0.2 && (anime.aspectScores.pacing || 10) < 5.0) {
      penalty += 0.5;
    }

    // 5. Format Compatibility
    if (anime.format && taste.formats[anime.format]?.score) {
      formatScore = Math.max(0, taste.formats[anime.format].score * 0.2);
    }

    // Combined compound affinity score (0.0 to 1.0)
    const rawCompound =
      genreScore * 0.35 +
      themeScore * 0.2 +
      studioScore * 0.2 +
      aspectScore * 0.15 +
      formatScore * 0.1 -
      penalty * 0.3;

    const overallAffinity = parseFloat(Math.max(0.0, Math.min(1.0, rawCompound)).toFixed(3));
    const primaryMatchReason = reasons.length > 0 ? reasons[0] : 'Recommended based on overall anime quality';

    return {
      animeId: anime.animeId,
      overallAffinity,
      genreAffinity: parseFloat(genreScore.toFixed(3)),
      themeAffinity: parseFloat(themeScore.toFixed(3)),
      studioAffinity: parseFloat(studioScore.toFixed(3)),
      aspectAffinity: parseFloat(aspectScore.toFixed(3)),
      formatAffinity: parseFloat(formatScore.toFixed(3)),
      penalty: parseFloat(penalty.toFixed(3)),
      primaryMatchReason,
      reasons,
      isExplorationCandidate,
    };
  }
}

export const contentPreferenceEngine = new ContentPreferenceEngine();
