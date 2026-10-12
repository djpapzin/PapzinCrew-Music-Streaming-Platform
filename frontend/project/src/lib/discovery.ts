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
export const filterMixes = (songs: Song[], query: string, genre: string) => songs.filter(song =>
  (!genre || genreOf(song) === genre)
  && [song.title, song.artist, song.album, song.genre, getMixSeries(song)].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
export const durationLabel = (seconds: number) => seconds > 0
  ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : 'Duration unavailable';
