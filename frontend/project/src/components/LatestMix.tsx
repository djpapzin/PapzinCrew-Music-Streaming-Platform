import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import type { Song } from '../types/music';
import { DEFAULT_ARTWORK_URL, safeArtworkUrl } from '../lib/artwork';

// Catalog IDs follow publication/upload order. Only public songs reach this view.
export function latestMix(songs: Song[]): Song | undefined {
  return songs.filter(song => song.playable !== false && song.audioUrl)
    .reduce<Song | undefined>((latest, song) => !latest || Number(song.id) > Number(latest.id) ? song : latest, undefined);
}
export default function LatestMix({ songs, onPlaySong }: { songs: Song[]; onPlaySong: (song: Song, queue?: Song[]) => void }) {
  const mix = latestMix(songs);
  if (!mix) return null;
  return <section aria-label="Latest mix" className="rounded-xl border border-purple-400/30 bg-gradient-to-br from-purple-900/50 to-pink-900/30 p-4 sm:p-5 flex flex-row gap-4 sm:gap-5">
    <Link to={`/track/${mix.id}`} aria-label={`View ${mix.title}`} className="shrink-0 self-start"><img alt="" src={safeArtworkUrl(mix.imageUrl)} onError={event=>{if(event.currentTarget.src!==DEFAULT_ARTWORK_URL)event.currentTarget.src=DEFAULT_ARTWORK_URL;}} className="w-20 h-20 sm:w-40 sm:h-40 rounded-xl object-cover"/></Link>
    <div className="min-w-0 space-y-3"><p className="text-purple-200 text-sm font-semibold">Latest mix</p><h2 className="text-lg sm:text-2xl font-bold break-words"><Link to={`/track/${mix.id}`}>{mix.title}</Link></h2><p className="text-gray-300">{mix.artist}</p><div className="flex flex-wrap gap-3"><button onClick={()=>onPlaySong(mix,songs)} className="min-h-11 inline-flex items-center gap-2 rounded-full bg-purple-600 px-5 py-2"><Play size={18}/>Play latest mix</button><Link className="min-h-11 inline-flex items-center text-purple-200" to={`/track/${mix.id}`}>Mix details →</Link></div></div>
  </section>;
}
