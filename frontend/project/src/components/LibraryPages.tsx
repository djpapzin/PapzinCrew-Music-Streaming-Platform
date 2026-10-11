import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Song } from '../types/music';
import { useLibrary } from '../state/LibraryContext';
import SongRow from './SongRow';
export function TrackList({songs,currentSong,isPlaying,onPlaySong}:{songs:Song[];currentSong:Song|null;isPlaying:boolean;onPlaySong:(song:Song,queue?:Song[])=>void}) {
  return songs.length ? <div className="rounded-xl bg-white/5">{songs.map((song,index)=><SongRow key={song.id} song={song} index={index} isPlaying={song.id===currentSong?.id&&isPlaying} onPlay={()=>onPlaySong(song,songs)}/>)}</div> : <p className="p-6 bg-white/5 rounded-xl text-gray-300">No tracks here yet.</p>;
}
export function PlaylistsPage() {
  const {library,createPlaylist} = useLibrary();
  const [name,setName]=useState('');
  const navigate=useNavigate();
  return <section className="space-y-5"><h2 className="text-2xl font-bold">Your Playlists</h2><p className="text-gray-400">Your playlists are saved in this browser.</p>
    <form className="flex gap-3" onSubmit={e=>{e.preventDefault();if(name.trim())navigate(`/playlists/${createPlaylist(name)}`);}}><input required aria-label="Playlist name" maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="Playlist name" className="bg-white/10 p-3 rounded-lg min-w-0 flex-1"/><button className="rounded-lg bg-purple-600 px-4">Create playlist</button></form>
    {library.playlists.length===0?<p className="text-gray-300">Create your first playlist, then add tracks using their options menu.</p>:<div className="grid sm:grid-cols-2 gap-4">{library.playlists.map(p=><Link className="rounded-xl bg-white/5 p-5 hover:bg-white/10" key={p.id} to={`/playlists/${p.id}`}><h3 className="font-semibold">{p.title}</h3><p className="text-gray-400">{p.songIds.length} tracks</p></Link>)}</div>}
  </section>;
}
export function PlaylistEditor({currentSong,isPlaying,onPlaySong}:{currentSong:Song|null;isPlaying:boolean;onPlaySong:(song:Song,queue?:Song[])=>void}) {
  const {id}=useParams(); const {library,songs,savePlaylist}=useLibrary();
  const playlist=library.playlists.find(p=>p.id===id);
  const [title,setTitle]=useState(playlist?.title||'');
  const [ids,setIds]=useState(playlist?.songIds||[]);
  const [query,setQuery]=useState('');
  useEffect(()=>{setTitle(playlist?.title||'');setIds(playlist?.songIds||[]);setQuery('');},[id]);
  if(!playlist) return <p>Playlist not found. <Link to="/playlists" className="text-purple-300">View playlists</Link></p>;
  const selected=ids.map(id=>songs.find(song=>song.id===id)).filter((s):s is Song=>!!s);
  return <section className="space-y-5"><h2 className="text-2xl font-bold">Edit playlist</h2><form className="space-y-4" onSubmit={e=>{e.preventDefault();savePlaylist({...playlist,title:title.trim(),songIds:ids});}}>
    <label className="block">Playlist title<input aria-label="Playlist title" required maxLength={80} value={title} onChange={e=>setTitle(e.target.value)} className="block w-full p-3 mt-2 rounded-lg bg-white/10"/></label>
    <button className="bg-purple-600 rounded-lg px-4 py-2">Save playlist</button>
  </form><h3 className="text-xl">Playlist tracks</h3><TrackList songs={selected} currentSong={currentSong} isPlaying={isPlaying} onPlaySong={onPlaySong}/>
    <h3 className="text-xl">Choose tracks</h3><input aria-label="Filter playlist tracks" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tracks to add or remove" className="bg-white/10 rounded-lg p-3 w-full"/>
    <div className="max-h-80 overflow-auto rounded-xl border border-white/10">{songs.filter(s=>(s.title+' '+s.artist).toLowerCase().includes(query.toLowerCase())).map(song=><label key={song.id} className="flex gap-3 p-3 border-b border-white/10"><input type="checkbox" checked={ids.includes(song.id)} onChange={e=>setIds(prev=>e.target.checked?[...prev,song.id]:prev.filter(id=>id!==song.id))}/><span>{song.title}</span></label>)}</div>
  </section>;
}
