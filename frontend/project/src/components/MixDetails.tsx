import ListenerPlayCount from './ListenerPlayCount';
import { playbackUrl, downloadUrl } from '../lib/playbackUrl';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Play, Pause, Headphones, ListMusic, Download } from 'lucide-react';
import { Song } from '../types/music';
import { getMixSeries, sortCollectionTracks } from '../lib/catalog';
import { relatedMixes, durationLabel } from '../lib/discovery';
import { safeArtworkUrl, DEFAULT_ARTWORK_URL } from '../lib/artwork';
import { TrackList } from './LibraryPages';
import SongActions from './SongActions';
import { API_BASE, toAbsoluteApiUrl } from '../lib/api';

interface Props {
  songs: Song[]; loading: boolean; error: string | null; currentSong: Song | null; isPlaying: boolean;
  onPlaySong: (song: Song, queue?: Song[]) => void; onTogglePlay: () => void;
}
export default function MixDetails({ songs, loading, error, currentSong, isPlaying, onPlaySong, onTogglePlay }: Props) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const catalogSong = songs.find(item => item.id === id);
  const [directSong, setDirectSong] = useState<Song | null>(null);
  const [downloadNotice, setDownloadNotice] = useState(false);
  const [directStatus, setDirectStatus] = useState<{ id?: string; message: string }>({ message: '' });
  useEffect(() => {
    if (!id || catalogSong) return;
    const controller = new AbortController();
    setDirectSong(null);
    setDirectStatus({ id, message: 'Loading mix…' });
    // Resolve shared/upload links directly without adding unlisted tracks to discovery.
    fetch(`${API_BASE}/tracks/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403
          ? 'This mix requires authorized access.' : response.status === 404
            ? 'Mix not found.' : 'Unable to load this mix. Please try again.');
        return response.json();
      })
      .then(mix => {
        if (controller.signal.aborted) return;
        setDirectSong({
          id: String(mix.id), title: mix.title || 'Untitled',
          artist: mix.artist?.name || 'Unknown Artist', album: mix.album || '',
          duration: mix.duration_seconds || 0, imageUrl: safeArtworkUrl(toAbsoluteApiUrl(mix.cover_art_url)),
          audioUrl: playbackUrl(mix),
          downloadUrl: downloadUrl(mix),
          downloadAllowed: (mix.availability || 'public') === 'public' && mix.allow_downloads === 'yes',
          genre: mix.genre || '', year: mix.year || 0, playable: Boolean(mix.file_path),
          description: mix.description || '', tracklist: mix.tracklist || '',
        });
        setDirectStatus({ id, message: '' });
      })
      .catch(reason => {
        if (!controller.signal.aborted) setDirectStatus({ id, message: reason.message });
      });
    return () => controller.abort();
  }, [id, catalogSong]);
  const song = catalogSong || (directSong?.id === id ? directSong : null);
  if (!song) return <p role="status">{directStatus.id === id ? directStatus.message : 'Loading mix…'} <Link to="/search" className="text-purple-300">Browse music</Link></p>;
  const series = getMixSeries(song);
  const related = relatedMixes(song, songs);
  const queue = catalogSong ? sortCollectionTracks(songs.filter(item => getMixSeries(item) === series)) : [song];
  const active = currentSong?.id === song.id;
  const playing = active && isPlaying;
  const unavailable = song.playable === false || !song.audioUrl;
  return <article className="max-w-5xl mx-auto space-y-8">
    {searchParams.has('uploaded') && <section role="status" className="rounded-xl border border-purple-400/40 bg-purple-950/30 p-4 space-y-2"><h2 className="font-semibold">Upload received — saved for review</h2><p>Your mix starts unlisted, so it won’t appear in public search until DJ Papzin approves it.</p><p>{searchParams.get('uploaded') === 'saved' ? 'Find this link again in My uploads on this browser.' : 'This browser couldn’t save your link. Bookmark this page so you can find it again.'} No account needed.</p><Link to="/upload#my-uploads" className="text-purple-200 underline">My uploads</Link></section>}
    <Link to="/search" className="inline-flex min-h-11 items-center text-purple-300">← Browse mixes</Link>
    <section className="rounded-3xl border border-purple-400/20 bg-gradient-to-br from-purple-900/50 via-gray-900 to-black p-5 sm:p-8 flex flex-col sm:flex-row gap-6">
      <img src={safeArtworkUrl(song.imageUrl)} alt={`${song.title} cover`} onError={e => { if (e.currentTarget.src !== DEFAULT_ARTWORK_URL) e.currentTarget.src = DEFAULT_ARTWORK_URL; }} className="w-48 self-center sm:self-start sm:w-56 aspect-square object-cover rounded-2xl shadow-xl" />
      <div className="min-w-0 flex-1 space-y-4">
        <p className="text-xs uppercase tracking-widest text-purple-200 flex items-center gap-2"><Headphones size={16}/> The mix archive</p>
        <h2 className="text-3xl sm:text-4xl font-bold break-words">{song.title}</h2>
        <Link className="inline-block text-lg text-purple-200 underline underline-offset-4" to={`/artists?artist=${encodeURIComponent(song.artist)}`}>{song.artist}</Link>
        <ListenerPlayCount mixId={song.id}/><p className="text-gray-300">{durationLabel(song.duration)}{song.year > 0 ? ` • ${song.year}` : ''}</p>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-full bg-white/10 px-3 py-2 text-sm" to={`/albums?series=${encodeURIComponent(series)}`}>{series}</Link>
          {song.genre.trim() && <Link className="rounded-full bg-white/10 px-3 py-2 text-sm" to={`/search?genre=${encodeURIComponent(song.genre.trim())}`}>{song.genre.trim()}</Link>}
        </div>
        <div className="flex flex-wrap gap-4 items-center pt-2">
          <button disabled={unavailable} onClick={() => active ? onTogglePlay() : onPlaySong(song, queue)} className="inline-flex items-center gap-2 min-h-12 rounded-full bg-purple-600 hover:bg-purple-500 px-6 font-semibold disabled:opacity-40">{playing ? <Pause size={19}/> : <Play size={19}/>} {unavailable ? 'Unavailable' : playing ? 'Pause mix' : active ? 'Resume mix' : 'Play mix'}</button>
          <div className="flex items-center gap-4"><SongActions song={song}/></div>
          {song.downloadAllowed && (song.downloadUrl ? <a href={song.downloadUrl} download className="inline-flex items-center gap-2 min-h-12 rounded-full border border-purple-400/50 px-5 font-semibold hover:bg-purple-900/40"><Download size={19}/> Download mix</a> : <button type="button" aria-disabled="true" title="Download is being prepared" onClick={() => setDownloadNotice(true)} onMouseEnter={() => setDownloadNotice(true)} onFocus={() => setDownloadNotice(true)} className="inline-flex items-center gap-2 min-h-12 rounded-full border border-gray-500/50 text-gray-400 cursor-not-allowed px-5 font-semibold"><Download size={19}/> Download mix</button>)}
        </div>
        {song.downloadAllowed && downloadNotice && <p role="status" className="text-sm text-gray-300">Download is being prepared. Please stream this mix for now.</p>}
      </div>
    </section>
    <div className="grid md:grid-cols-2 gap-5">
      <section className="rounded-2xl bg-white/5 p-5 sm:p-6 space-y-3"><h3 className="text-xl font-semibold">About this mix</h3><p className="text-gray-300 whitespace-pre-wrap break-words leading-relaxed">{song.description?.trim() || `${song.title} by ${song.artist}, from ${series}. Explore the collection for more mixes.`}</p></section>
      <section className="rounded-2xl bg-white/5 p-5 sm:p-6 space-y-3"><h3 className="text-xl font-semibold flex items-center gap-2"><ListMusic size={20}/> Tracklist</h3>{song.tracklist?.trim() ? <p className="text-gray-300 whitespace-pre-wrap break-words leading-relaxed">{song.tracklist}</p> : <p className="text-gray-400">A tracklist hasn’t been added for this mix yet.</p>}</section>
    </div>
    {related.length > 0 && <section className="space-y-4"><div className="flex flex-wrap justify-between gap-3 items-center"><h3 className="text-xl font-semibold">Keep listening</h3><Link className="text-purple-300 min-h-11 inline-flex items-center" to={`/albums?series=${encodeURIComponent(series)}`}>Explore the series →</Link></div><p className="text-gray-400 text-sm">More from this series, artist, or genre.</p><TrackList songs={related} currentSong={currentSong} isPlaying={isPlaying} onPlaySong={onPlaySong}/></section>}
  </article>;
}
