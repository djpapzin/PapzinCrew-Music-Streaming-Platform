import { Routes, Route, Link, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { Song, Playlist, Album, Artist } from '../types/music';
import { useLibrary } from '../state/LibraryContext';
import { PlaylistsPage, PlaylistEditor, TrackList } from './LibraryPages';
import { ProfilePage, SettingsPage, NotificationsPage, AccountPage } from './ListenerPages';
import QuickPlay from './QuickPlay';
import QuickPlayCard from './QuickPlayCard';
import UploadPage from './UploadPage';
import AdminAnalyticsPanel from './AdminAnalyticsPanel';
import SongActions from './SongActions';
import { getMixSeries as series, sortCollectionTracks, TPW_SERIES } from '../lib/catalog';
import InstallAppPage from './InstallAppPage';
interface Props {
  searchQuery:string; songs:Song[]; playlists:Playlist[]; albums:Album[]; artists:Artist[];
  tracksLoading:boolean; tracksError:string|null; currentSong:Song|null; isPlaying:boolean;
  onPlaySong:(song:Song,queue?:Song[])=>void; onPlayPlaylist:(playlist:Playlist|Album)=>void;
  volume:number;setVolume:(volume:number)=>void;onRetry:()=>void;
}
function TrackPage({songs,onPlaySong}:{songs:Song[];onPlaySong:(song:Song,queue?:Song[])=>void}) {
  const {id}=useParams();const song=songs.find(s=>s.id===id);
  if(!song)return <p>Track not found. <Link to="/search" className="text-purple-300">Search music</Link></p>;
  return <section className="space-y-5"><img src={song.imageUrl} alt={`${song.title} cover`} className="w-52 rounded-xl"/><h2 className="text-2xl font-bold">{song.title}</h2><p className="text-gray-300">{song.artist}</p><p>{series(song)}{song.genre?` • ${song.genre}`:''} • {Math.floor(song.duration/60)}:{String(Math.floor(song.duration%60)).padStart(2,'0')}</p><button className="bg-purple-600 rounded-lg px-5 py-3" onClick={()=>onPlaySong(song,songs)}>Play track</button><div className="flex gap-4"><SongActions song={song}/></div></section>;
}
export default function MainContent({searchQuery,songs,tracksLoading,tracksError,currentSong,isPlaying,onPlaySong,volume,setVolume,onRetry}:Props) {
  const {library}=useLibrary();
  const {pathname}=useLocation();
  const [searchParams,setSearchParams]=useSearchParams();
  const list=(items:Song[])=> <TrackList songs={items} currentSong={currentSong} isPlaying={isPlaying} onPlaySong={onPlaySong}/>;
  const quick=(items=songs)=><QuickPlay songs={items} playlists={[]} onPlaySong={onPlaySong} onPlayPlaylist={()=>{}}/>;
  const artistNames=Array.from(new Set(songs.map(song=>song.artist))).sort();
  const albumNames=Array.from(new Set(songs.map(series))).sort();
  const recent=library.recent.map(id=>songs.find(s=>s.id===id)).filter((s):s is Song=>!!s);
  const tpw=sortCollectionTracks(songs.filter(song=>series(song)===TPW_SERIES));
  const collectionView=(kind:'artist'|'album')=>{
    const names=kind==='artist'?artistNames:albumNames;
    const key=kind==='artist'?'artist':'series';
    const selected=searchParams.get(key);
    const items=selected?sortCollectionTracks(songs.filter(s=>(kind==='artist'?s.artist:series(s))===selected)):[];
    return <section className="space-y-5"><h2 className="text-2xl font-bold">{kind==='artist'?'Artists':'Albums & Mix Series'}</h2>{selected?<><button className="text-purple-300" onClick={()=>setSearchParams({})}>← All {kind==='artist'?'artists':'collections'}</button><h3 className="text-xl">{selected}</h3><p className="text-gray-400">{items.length} tracks{selected===TPW_SERIES?' • Numbered mixes first, then bonus mixes and collaborations':''}</p>{items.length>0?<>{quick(items)}{list(items)}</>:!tracksLoading&&!tracksError?<p>This collection is not in the catalog.</p>:null}</>:<div className="grid grid-cols-2 md:grid-cols-3 gap-4">{names.map(name=>{const items=sortCollectionTracks(songs.filter(s=>(kind==='artist'?s.artist:series(s))===name));return <button key={name} onClick={()=>setSearchParams({[key]:name})} className="rounded-xl bg-white/5 hover:bg-white/10 p-4 text-left"><img alt="" src={items[0].imageUrl} className="w-full aspect-square object-cover rounded-xl mb-3"/><h3 className="font-semibold">{name}</h3><p className="text-gray-400">{items.length} tracks</p></button>;})}</div>}</section>;
  };
  const results=songs.filter(s=>[s.title,s.artist,s.album,s.genre,series(s)].join(' ').toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const catalogStatus=tracksLoading?<p role="status" className="p-4 text-purple-200">Loading music… The catalog may take a minute to wake up.</p>:tracksError?<div role="alert" className="p-5 bg-amber-500/10 rounded-xl"><p>Music couldn't load. Please try again.</p><button className="mt-3 px-4 py-2 rounded-lg bg-purple-600" onClick={onRetry}>Retry catalog</button></div>:null;
  return <main className="flex-1 bg-gradient-to-b from-gray-900/50 to-black p-4 lg:p-6 overflow-y-auto pb-40 lg:pb-32">
    {pathname!=='/install'&&catalogStatus}
    <Routes>
      <Route path="/" element={<div className="space-y-7"><section className="bg-gradient-to-br from-purple-900/60 to-pink-900/60 rounded-xl p-6 border border-purple-500/30"><h2 className="text-2xl lg:text-4xl font-bold mb-3">Welcome to Papzin & Crew</h2><p className="text-gray-300">Discover the mixes, artists, and sounds of Papzin & Crew.</p><div className="flex flex-wrap gap-3 mt-5"><Link className="bg-white/10 rounded-full px-4 py-2" to="/independent">Discover artists</Link><Link className="bg-white/10 rounded-full px-4 py-2" to="/search">Browse music</Link><Link className="bg-white/10 rounded-full px-4 py-2" to="/install">Get the app</Link></div></section>{quick()}{tpw.length>0&&<section className="rounded-xl bg-white/5 p-5 border border-white/10"><div className="flex items-center gap-4"><img src={tpw[0].imageUrl} alt="DJ Papzin archive artwork" className="w-20 h-20 object-cover rounded-lg"/><div><h2 className="text-xl font-bold">The Pristine World archive</h2><p className="text-gray-400 mt-1">{tpw.length} mixes • Start at TPW 1 and follow the series.</p><Link className="inline-block text-purple-300 mt-3" to={`/albums?series=${encodeURIComponent(TPW_SERIES)}`}>Explore TPW mixes →</Link></div></div></section>}<section><h2 className="text-2xl font-bold mb-4">Featured mixes</h2><div className="grid sm:grid-cols-2 gap-3">{songs.slice(0,6).map(song=><QuickPlayCard key={song.id} item={song} type="song" onPlay={()=>onPlaySong(song,songs)}/>)}</div></section>{recent.length>0&&<section><h2 className="text-2xl font-bold mb-4">Recently played</h2>{list(recent)}</section>}<div className="flex gap-4"><Link to="/albums" className="text-purple-300">Albums & mix series →</Link><Link to="/playlists" className="text-purple-300">Your playlists →</Link></div></div>}/>
      <Route path="/search" element={<section className="space-y-5"><h2 className="text-2xl font-bold">{searchQuery.trim()?'Search results':'Browse music'}</h2>{!searchQuery.trim()&&quick()}{results.length?list(results):!tracksLoading&&!tracksError?<p className="p-6 bg-white/5 rounded-xl">No results for “{searchQuery}”. Try an artist, title, or genre.</p>:null}</section>}/>
      <Route path="/library" element={<section className="space-y-5"><h2 className="text-2xl font-bold">Your Library</h2><div className="flex flex-wrap gap-4"><Link to="/playlists" className="text-purple-300">Playlists ({library.playlists.length})</Link><Link to="/liked" className="text-purple-300">Liked Songs ({library.liked.length})</Link><Link to="/albums" className="text-purple-300">Albums & Mix Series</Link></div><h3 className="text-xl">{recent.length?'Recently played':'All tracks'}</h3>{list(recent.length?recent:songs)}</section>}/>
      <Route path="/playlists" element={<PlaylistsPage/>}/>
      <Route path="/playlists/:id" element={<PlaylistEditor key={window.location.pathname} currentSong={currentSong} isPlaying={isPlaying} onPlaySong={onPlaySong}/>}/>
      <Route path="/liked" element={<section className="space-y-5"><h2 className="text-2xl font-bold">Liked Songs</h2><p className="text-gray-400">Tap a heart to save a favorite in this browser.</p>{list(songs.filter(s=>library.liked.includes(s.id)))}</section>}/>
      <Route path="/artists" element={collectionView('artist')}/>
      <Route path="/independent" element={collectionView('artist')}/>
      <Route path="/albums" element={collectionView('album')}/>
      <Route path="/trending" element={<section className="space-y-5"><h2 className="text-2xl font-bold">Discover mixes</h2><p className="text-gray-400">Explore the latest catalog additions.</p>{quick()}{list(songs.slice(0,20))}</section>}/>
      <Route path="/track/:id" element={<TrackPage songs={songs} onPlaySong={onPlaySong}/>}/>
      <Route path="/profile" element={<ProfilePage/>}/>
      <Route path="/settings" element={<SettingsPage volume={volume} setVolume={setVolume}/>}/>
      <Route path="/install" element={<InstallAppPage/>}/>
      <Route path="/notifications" element={<NotificationsPage/>}/>
      <Route path="/account" element={<AccountPage/>}/>
      <Route path="/upload" element={<UploadPage onPlaySong={onPlaySong}/>}/>
      <Route path="/admin" element={<AdminAnalyticsPanel/>}/>
      <Route path="*" element={<p>Page not found. <Link className="text-purple-300" to="/">Go home</Link></p>}/>
    </Routes>
  </main>;
}
