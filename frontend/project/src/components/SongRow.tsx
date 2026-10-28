import DeferredImage from './DeferredImage';
import { Link } from 'react-router-dom';
import { Play, AlertCircle } from 'lucide-react';
import { Song } from '../types/music';
import { safeArtworkUrl, DEFAULT_ARTWORK_URL } from '../lib/artwork';
import SongActions from './SongActions';
interface Props {song:Song;index:number;isPlaying:boolean;onPlay:()=>void}
const format=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
export default function SongRow({song,isPlaying,onPlay}:Props) {
  const disabled=song.playable===false||!song.audioUrl;
  return <div className="flex items-center gap-3 p-3 lg:px-4 rounded-lg hover:bg-white/5">
    <button aria-label={`Play ${song.title}`} disabled={disabled} onClick={onPlay} className="relative w-12 h-12 shrink-0 rounded overflow-hidden disabled:opacity-40">
      <DeferredImage loading="lazy" decoding="async" src={safeArtworkUrl(song.imageUrl)} alt="" className="w-full h-full object-cover" onError={e=>{if(e.currentTarget.src!==DEFAULT_ARTWORK_URL)e.currentTarget.src=DEFAULT_ARTWORK_URL;}}/>
      <span className="absolute inset-0 bg-black/50 flex items-center justify-center"><Play className={isPlaying?'w-5 h-5 text-green-400':'w-5 h-5'}/></span>
    </button><div className="flex-1 min-w-0"><Link to={`/track/${song.id}`} className={`block font-medium truncate hover:underline ${isPlaying?'text-green-400':''}`}>{song.title}</Link><p className="text-gray-400 text-sm truncate">{song.artist}{song.album?` • ${song.album}`:''}</p>{disabled&&<p className="text-red-300 text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3"/>Unavailable</p>}</div>
    <span className="text-sm text-gray-400 hidden sm:block">{format(song.duration)}</span><div className="flex gap-3 shrink-0"><SongActions song={song}/></div>
  </div>;
}
