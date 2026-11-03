import { Song } from '../types/music';
import { getMixSeries, sortCollectionTracks } from './catalog';

export const genreOf = (song: Song) => song.genre.trim() || 'Uncategorized';
export const relatedMixes = (song: Song, songs: Song[]) => {
  const score = (other: Song) => (getMixSeries(other) === getMixSeries(song) ? 4 : 0)
    + (other.artist === song.artist ? 2 : 0)
    + (song.genre.trim() && genreOf(other) === genreOf(song) ? 1 : 0);
  return sortCollectionTracks(songs.filter(other => other.id !== song.id && other.playable !== false && !!other.audioUrl))
    .filter(other => score(other) > 0).sort((a, b) => score(b) - score(a)).slice(0, 6);
};
export const similarMixReason = (song: Song, other: Song) => {
  if (getMixSeries(song) === getMixSeries(other)) return 'Same mix series';
  if (song.artist === other.artist) return 'Same DJ';
  return `Also in ${genreOf(song)}`;
};

export const durationFilters = [
  { value: 'short', label: 'Under 30 minutes', min: 0, max: 1800 },
  { value: 'medium', label: '30 to under 60 minutes', min: 1800, max: 3600 },
  { value: 'long', label: '60 minutes or more', min: 3600, max: Infinity },
];

export const filterMixes = (songs: Song[], query: string, genre: string, duration = '') => {
  const range = durationFilters.find(filter => filter.value === duration);
  const search = query.trim().toLowerCase();
  return songs.filter(song =>
    (!genre || genreOf(song) === genre)
    && (!range || (song.duration > 0 && song.duration >= range.min && song.duration < range.max))
    && [song.title, song.artist, song.album, song.genre, getMixSeries(song)].join(' ').toLowerCase().includes(search));
};
export const durationLabel = (seconds: number) => seconds > 0
  ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : 'Duration unavailable';
