import { useRef } from 'react';
import { Play, Pause, Shuffle, Radio } from 'lucide-react';
import { Song, Playlist } from '../types/music';
interface Props {
  songs:Song[];playlists:Playlist[];onPlaySong:(song:Song,queue?:Song[])=>void;
  onPlayPlaylist:(playlist:Playlist)=>void;currentSong?:Song|null;isPlaying?:boolean;onTogglePlay?:()=>void;isLoading?:boolean;
}
export default function QuickPlay({songs,onPlaySong,currentSong,isPlaying=false,onTogglePlay,isLoading=false}:Props){
  const playable=songs.filter(song=>song.playable!==false&&song.audioUrl);
  const selected=playable.find(song=>song.id===currentSong?.id)||playable.find(song=>song.audioUrl.includes('playback-optimized'))||playable[0];
  const active=Boolean(selected&&selected.id===currentSong?.id);
  const lastAction=useRef(-Infinity);
  const once=(action:()=>void)=>{const now=performance.now();if(now-lastAction.current<450)return;lastAction.current=now;action();};
  const play=()=>once(()=>{if(!selected)return;if(active&&onTogglePlay)onTogglePlay();else onPlaySong(selected,playable);});
  const shuffle=()=>once(()=>{if(!playable.length)return;const queue=[...playable];for(let i=queue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[queue[i],queue[j]]=[queue[j],queue[i]];}onPlaySong(queue[0],queue);});
  const similar=()=>once(()=>{if(!selected)return;const related=playable.filter(song=>song.id!==selected.id&&(song.artist===selected.artist||(selected.genre&&song.genre===selected.genre)));const rest=playable.filter(song=>song.id!==selected.id&&!related.includes(song));onPlaySong(selected,[selected,...related,...rest]);});
  const label=active?(isLoading?'Cancel loading':isPlaying?'Pause mix':'Resume mix'):'Play mix';
  return <section className="min-w-0 rounded-xl border border-purple-500/20 bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-4 lg:p-6 space-y-4">
    <div><h3 className="text-lg lg:text-xl font-bold">Listen to a DJ mix</h3><p className="text-sm text-gray-300 mt-2 break-words">{selected?<>{active?'Selected mix: ':'Start with: '}<strong>{selected.title}</strong> · {selected.artist}</>:'Loading DJ mixes…'}</p><p className="text-sm text-gray-400 mt-1">Free listening. No account needed.</p></div>
    {active&&isLoading&&<p role="status" className="text-purple-200 text-sm">Loading this mix… Slow connections may take longer. You can cancel below.</p>}
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
      <button onClick={play} disabled={!selected} className="min-h-11 flex items-center justify-center gap-2 rounded-full bg-white text-black px-4 py-2 disabled:opacity-50">{active&&isPlaying?<Pause className="w-4 h-4"/>:<Play className="w-4 h-4"/>}{label}</button>
      <button onClick={shuffle} disabled={!selected} className="min-h-11 flex items-center justify-center gap-2 rounded-full bg-green-700 px-4 py-2 disabled:opacity-50"><Shuffle className="w-4 h-4"/>Shuffle mixes</button>
      <button onClick={similar} disabled={!selected} className="min-h-11 flex items-center justify-center gap-2 rounded-full bg-purple-700 px-4 py-2 disabled:opacity-50"><Radio className="w-4 h-4"/>Play similar mixes</button>
    </div><p className="text-xs text-gray-400">Shuffle picks a random mix. Similar mixes follows the selected artist or genre.</p>
  </section>;
}
