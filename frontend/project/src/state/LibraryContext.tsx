import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { Song } from '../types/music';
export interface SavedPlaylist { id: string; title: string; songIds: string[] }
interface Library { liked: string[]; playlists: SavedPlaylist[]; recent: string[]; profile: {name:string;bio:string}; notifications: {id:string;message:string;time:string}[] }
const empty: Library = {liked:[], playlists:[], recent:[], profile:{name:'Music lover',bio:''}, notifications:[]};
export const LIBRARY_KEY = 'papzincrew:library:v1';
function read(): Library {
  try {
    const value = JSON.parse(localStorage.getItem(LIBRARY_KEY) || 'null');
    if (!value || !Array.isArray(value.liked) || !Array.isArray(value.playlists) || !Array.isArray(value.recent)) return empty;
    return {...empty,...value, playlists:value.playlists.filter((p:SavedPlaylist)=>typeof p.id==='string' && typeof p.title==='string' && Array.isArray(p.songIds)), profile:{...empty.profile,...value.profile}, notifications:Array.isArray(value.notifications)?value.notifications:[]};
  } catch { return empty; }
}
const Context = createContext<{
  library:Library; songs:Song[]; toggleLike:(id:string)=>void; createPlaylist:(title:string, songId?:string)=>string;
  savePlaylist:(playlist:SavedPlaylist)=>void; addToPlaylist:(playlistId:string,songId:string)=>void;
  updateProfile:(profile:Library['profile'])=>void; clearNotifications:()=>void;
} | null>(null);
export function LibraryProvider({songs,children}:{songs:Song[];children:ReactNode}) {
  const [library,setLibrary] = useState(read);
  const storageWarning = useRef(false);
  useEffect(()=> { try { localStorage.setItem(LIBRARY_KEY,JSON.stringify(library)); } catch { if (!storageWarning.current) { storageWarning.current = true; window.dispatchEvent(new CustomEvent('app:toast',{detail:{message:'Browser storage is full. Your changes could not be saved.'}})); } } },[library]);
  useEffect(()=> {
    const played=(e:Event)=>setLibrary(prev=>({...prev,recent:[(e as CustomEvent).detail,...prev.recent.filter(id=>id!==(e as CustomEvent).detail)].slice(0,30)}));
    const activity=(e:Event)=> { const message=(e as CustomEvent).detail?.message; if(message) setLibrary(prev=>({...prev,notifications:[{id:crypto.randomUUID(),message,time:new Date().toISOString()},...prev.notifications].slice(0,50)})); };
    window.addEventListener('library:played',played); window.addEventListener('app:toast',activity);
    return ()=>{window.removeEventListener('library:played',played);window.removeEventListener('app:toast',activity);};
  },[]);
  const notify=(message:string)=>window.dispatchEvent(new CustomEvent('app:toast',{detail:{message}}));
  const createPlaylist=(title:string,songId?:string)=> {
    const id=crypto.randomUUID(); setLibrary(prev=>({...prev,playlists:[...prev.playlists,{id,title:title.trim(),songIds:songId?[songId]:[]}]})); notify('Playlist created.'); return id;
  };
  return <Context.Provider value={{library,songs,
    toggleLike:id=>setLibrary(prev=>({...prev,liked:prev.liked.includes(id)?prev.liked.filter(item=>item!==id):[...prev.liked,id]})),
    createPlaylist,
    savePlaylist:playlist=>{setLibrary(prev=>({...prev,playlists:prev.playlists.map(p=>p.id===playlist.id?playlist:p)}));notify('Playlist saved.');},
    addToPlaylist:(playlistId,songId)=>{setLibrary(prev=>({...prev,playlists:prev.playlists.map(p=>p.id===playlistId?{...p,songIds:Array.from(new Set([...p.songIds,songId]))}:p)}));notify('Track added to playlist.');},
    updateProfile:profile=>{setLibrary(prev=>({...prev,profile}));notify('Profile saved.');},
    clearNotifications:()=>setLibrary(prev=>({...prev,notifications:[]}))
  }}>{children}</Context.Provider>;
}
export function useLibrary() { const value=useContext(Context); if(!value) throw new Error('LibraryProvider is required'); return value; }

export function useOptionalLibrary() { return useContext(Context); }
