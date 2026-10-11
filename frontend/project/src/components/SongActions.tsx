import { useState, useEffect } from 'react';
import { Heart, MoreHorizontal, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Song } from '../types/music';
import { useLibrary } from '../state/LibraryContext';
export default function SongActions({song}:{song:Song}) {
  const {library,toggleLike,addToPlaylist,createPlaylist} = useLibrary();
  const [open,setOpen] = useState(false);
  const [name,setName] = useState('');
  const navigate=useNavigate();
  const liked=library.liked.includes(song.id);
  useEffect(()=>{if(!open)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[open]);
  return <>
    <button aria-label={liked?`Unlike ${song.title}`:`Like ${song.title}`} aria-pressed={liked} onClick={()=>toggleLike(song.id)} className={liked?'text-pink-400':'text-gray-400 hover:text-white'}><Heart className="w-5 h-5" fill={liked?'currentColor':'none'}/></button>
    <button aria-label={`More options for ${song.title}`} onClick={()=>setOpen(true)} className="text-gray-400 hover:text-white"><MoreHorizontal className="w-5 h-5"/></button>
    {open && <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4" onClick={()=>setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="Track options" className="bg-gray-900 border border-white/20 rounded-2xl p-5 w-full max-w-md space-y-4 max-h-[85vh] overflow-auto" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-between gap-4"><h2 className="font-semibold">{song.title}</h2><button aria-label="Close track options" onClick={()=>setOpen(false)}><X/></button></div>
        <Link className="block text-purple-300" to={`/track/${song.id}`} onClick={()=>setOpen(false)}>Track details</Link>
        <button className="block text-purple-300" onClick={()=>{window.dispatchEvent(new CustomEvent('player:queue',{detail:song}));setOpen(false);}}>Add to queue</button>
        <button className="block text-purple-300" onClick={async()=>{try {await navigator.clipboard.writeText(`${window.location.origin}/track/${song.id}`);window.dispatchEvent(new CustomEvent('app:toast',{detail:{message:'Track link copied.'}}));}catch {navigate(`/track/${song.id}`);}setOpen(false);}}>Copy track link</button>
        <h3 className="font-semibold">Add to playlist</h3>
        {library.playlists.map(p=><button key={p.id} className="block w-full text-left rounded-lg bg-white/10 p-3" onClick={()=>{addToPlaylist(p.id,song.id);setOpen(false);}}>{p.title}</button>)}
        <form onSubmit={e=>{e.preventDefault();if(name.trim()){createPlaylist(name,song.id);setOpen(false);}}} className="flex gap-2"><input aria-label="New playlist name" value={name} onChange={e=>setName(e.target.value)} maxLength={80} placeholder="New playlist name" className="bg-black rounded-lg p-2 min-w-0 flex-1" required/><button className="bg-purple-600 px-3 rounded-lg">Create</button></form>
      </section>
    </div>}
  </>;
}
