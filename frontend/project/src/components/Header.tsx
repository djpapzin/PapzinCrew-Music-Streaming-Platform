import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Bell, Settings, User, Menu, Upload } from 'lucide-react';
import { useLibrary } from '../state/LibraryContext';
import { getSastGreeting } from '../lib/greeting';
interface Props {searchQuery:string;setSearchQuery:(query:string)=>void;onMenuClick?:()=>void}
const titles:Record<string,string>={'/library':'Your Library','/search':'Search','/playlists':'Your Playlists','/artists':'Artists','/albums':'Albums & Mix Series','/liked':'Liked Songs','/independent':'Independent Artists','/trending':'Discover mixes','/upload':'Upload Music','/profile':'Your Profile','/account':'Your Account','/settings':'Settings','/notifications':'Notifications','/admin':'Catalog Overview'};
export default function Header({searchQuery,setSearchQuery,onMenuClick}:Props) {
  const [open,setOpen]=useState(false);const location=useLocation();const navigate=useNavigate();const {library}=useLibrary();
  const [greeting,setGreeting]=useState(getSastGreeting);
  useEffect(()=>{
    const refresh=()=>setGreeting(getSastGreeting());
    const timer=window.setInterval(refresh,60_000);
    window.addEventListener('focus',refresh);
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[]);
  useEffect(()=>{setOpen(false);},[location.pathname]);
  useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[]);
  return <header className="bg-black/50 border-b border-white/10 px-4 lg:px-6 py-4 flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0 flex-1"><button aria-label="Open navigation menu" onClick={onMenuClick} className="lg:hidden p-2"><Menu className="w-5 h-5"/></button><div className="hidden lg:flex gap-2"><button aria-label="Go back" onClick={()=>navigate(-1)} className="p-2 bg-white/5 rounded-full"><ChevronLeft className="w-4 h-4"/></button><button aria-label="Go forward" onClick={()=>navigate(1)} className="p-2 bg-white/5 rounded-full"><ChevronRight className="w-4 h-4"/></button></div>
    {location.pathname==='/search'?<div className="relative min-w-0 max-w-md flex-1"><Search className="absolute left-3 top-3 w-4 h-4 text-gray-400"/><input aria-label="Search music" placeholder="Search for songs, artists, albums..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="w-full bg-white/10 rounded-full pl-9 pr-3 py-2 text-white"/></div>:<h1 className="font-bold text-xl truncate">{location.pathname==='/'?greeting:titles[location.pathname]||'Papzin & Crew'}</h1>}</div>
    <div className="flex items-center gap-2 flex-shrink-0">{location.pathname!=='/upload'&&<Link aria-label="Upload Music" to="/upload" className="rounded-full bg-purple-600 p-2"><Upload className="w-4 h-4"/></Link>}<Link aria-label="Notifications" to="/notifications" className="p-2 hidden sm:block"><Bell className="w-4 h-4"/></Link><Link aria-label="Settings" to="/settings" className="p-2 hidden sm:block"><Settings className="w-4 h-4"/></Link><div className="relative"><button aria-label="Account menu" aria-expanded={open} onClick={()=>setOpen(!open)} className="p-2 rounded-full bg-gradient-to-br from-purple-500 to-pink-500"><User className="w-4 h-4"/></button>{open&&<nav aria-label="Account options" className="absolute right-0 mt-3 w-52 bg-gray-900 rounded-xl shadow-xl border border-white/20 z-[60] p-2"><p className="px-3 py-2 text-gray-400 text-sm">{library.profile.name}</p>{[['/profile','Profile'],['/account','Account / Sign in'],['/settings','Settings'],['/notifications','Notifications'],['/admin','Catalog overview'],['/upload','Submit Music']].map(([to,label])=><Link className="block px-3 py-2 rounded-lg hover:bg-white/10" key={to} to={to}>{label}</Link>)}</nav>}</div></div>
  </header>;
}
