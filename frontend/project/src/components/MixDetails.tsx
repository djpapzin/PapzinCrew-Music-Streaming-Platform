import { Link, useParams } from 'react-router-dom';
import { Play, Pause, Headphones, ListMusic } from 'lucide-react';
import { Song } from '../types/music';
import { getMixSeries, sortCollectionTracks } from '../lib/catalog';
import { relatedMixes, durationLabel } from '../lib/discovery';
import { safeArtworkUrl, DEFAULT_ARTWORK_URL } from '../lib/artwork';
import { TrackList } from './LibraryPages';
import SongActions from './SongActions';

interface Props {
  songs: Song[]; loading: boolean; error: string | null; currentSong: Song | null; isPlaying: boolean;
  onPlaySong: (song: Song, queue?: Song[]) => void; onTogglePlay: () => void;
}
export default function MixDetails({ songs, loading, error, currentSong, isPlaying, onPlaySong, onTogglePlay }: Props) {
  const { id } = useParams();
  const song = songs.find(item => item.id === id);
  if (!song) return loading || error ? null : <p>Mix not found. <Link to="/search" className="text-purple-300">Browse music</Link></p>;
  const series = getMixSeries(song);
  const related = relatedMixes(song, songs);
  const queue = sortCollectionTracks(songs.filter(item => getMixSeries(item) === series));
  const active = currentSong?.id === song.id;
  const playing = active && isPlaying;
  const unavailable = song.playable === false || !song.audioUrl;
  return <article className="max-w-5xl mx-auto space-y-8">
    <Link to="/search" className="inline-flex min-h-11 items-center text-purple-300">← Browse mixes</Link>
    <section className="rounded-3xl border border-purple-400/20 bg-gradient-to-br from-purple-900/50 via-gray-900 to-black p-5 sm:p-8 flex flex-col sm:flex-row gap-6">
      <img src={safeArtworkUrl(song.imageUrl)} alt={`${song.title} cover`} onError={e => { if (e.currentTarget.src !== DEFAULT_ARTWORK_URL) e.currentTarget.src = DEFAULT_ARTWORK_URL; }} className="w-48 self-center sm:self-start sm:w-56 aspect-square object-cover rounded-2xl shadow-xl" />
      <div className="min-w-0 flex-1 space-y-4">
        <p className="text-xs uppercase tracking-widest text-purple-200 flex items-center gap-2"><Headphones size={16}/> The mix archive</p>
        <h2 className="text-3xl sm:text-4xl font-bold break-words">{song.title}</h2>
        <Link className="inline-block text-lg text-purple-200 underline underline-offset-4" to={`/artists?artist=${encodeURIComponent(song.artist)}`}>{song.artist}</Link>
        <p className="text-gray-300">{durationLabel(song.duration)}{song.year > 0 ? ` • ${song.year}` : ''}</p>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-full bg-white/10 px-3 py-2 text-sm" to={`/albums?series=${encodeURIComponent(series)}`}>{series}</Link>
          {song.genre.trim() && <Link className="rounded-full bg-white/10 px-3 py-2 text-sm" to={`/search?genre=${encodeURIComponent(song.genre.trim())}`}>{song.genre.trim()}</Link>}
        </div>
        <div className="flex flex-wrap gap-4 items-center pt-2">
          <button disabled={unavailable} onClick={() => active ? onTogglePlay() : onPlaySong(song, queue)} className="inline-flex items-center gap-2 min-h-12 rounded-full bg-purple-600 hover:bg-purple-500 px-6 font-semibold disabled:opacity-40">{playing ? <Pause size={19}/> : <Play size={19}/>} {unavailable ? 'Unavailable' : playing ? 'Pause mix' : active ? 'Resume mix' : 'Play mix'}</button>
          <div className="flex items-center gap-4"><SongActions song={song}/></div>
        </div>
      </div>
    </section>
    <div className="grid md:grid-cols-2 gap-5">
      <section className="rounded-2xl bg-white/5 p-5 sm:p-6 space-y-3"><h3 className="text-xl font-semibold">About this mix</h3><p className="text-gray-300 whitespace-pre-wrap break-words leading-relaxed">{song.description?.trim() || `${song.title} by ${song.artist}, from ${series}. Explore the collection for more mixes.`}</p></section>
      <section className="rounded-2xl bg-white/5 p-5 sm:p-6 space-y-3"><h3 className="text-xl font-semibold flex items-center gap-2"><ListMusic size={20}/> Tracklist</h3>{song.tracklist?.trim() ? <p className="text-gray-300 whitespace-pre-wrap break-words leading-relaxed">{song.tracklist}</p> : <p className="text-gray-400">A tracklist hasn’t been added for this mix yet.</p>}</section>
    </div>
    {related.length > 0 && <section className="space-y-4"><div className="flex flex-wrap justify-between gap-3 items-center"><h3 className="text-xl font-semibold">Keep listening</h3><Link className="text-purple-300 min-h-11 inline-flex items-center" to={`/albums?series=${encodeURIComponent(series)}`}>Explore the series →</Link></div><p className="text-gray-400 text-sm">More from this series, artist, or genre.</p><TrackList songs={related} currentSong={currentSong} isPlaying={isPlaying} onPlaySong={onPlaySong}/></section>}
  </article>;
}
