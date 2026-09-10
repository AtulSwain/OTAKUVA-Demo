import { AnimeProvider } from './animeProvider.interface';
import { anilistProvider } from './anilistProvider';
import { JikanProvider, jikanProvider } from './jikanProvider';

const PREFERRED = (process.env.ANILOG_PROVIDER || process.env.PREFERRED_PROVIDER || 'anilist').toLowerCase();

export { anilistProvider, JikanProvider, jikanProvider };

let defaultAnimeProvider: AnimeProvider = anilistProvider;
if (PREFERRED === 'jikan') {
  defaultAnimeProvider = jikanProvider;
}

export { defaultAnimeProvider };
