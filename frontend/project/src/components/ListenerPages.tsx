import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLibrary } from '../state/LibraryContext';
import { API_BASE } from '../lib/api';
const input='block w-full rounded-lg bg-white/10 p-3 mt-2';
export function ProfilePage() {
  const {library,updateProfile}=useLibrary();
  const [name,setName]=useState(library.profile.name); const [bio,setBio]=useState(library.profile.bio);
  return <form className="space-y-5 max-w-xl" onSubmit={e=>{e.preventDefault();updateProfile({name:name.trim(),bio:bio.trim()});}}><h2 className="text-2xl font-bold">Your profile</h2><p className="text-gray-400">Personalize your listener profile on this browser.</p><label className="block">Display name<input className={input} required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label><label className="block">About you<textarea className={input} maxLength={500} value={bio} onChange={e=>setBio(e.target.value)}/></label><button className="bg-purple-600 rounded-lg px-5 py-3">Save profile</button><Link className="block text-purple-300" to="/account">Manage account</Link></form>;
}
export function SettingsPage({volume,setVolume}:{volume:number;setVolume:(value:number)=>void}) {
  return <section className="space-y-5 max-w-xl"><h2 className="text-2xl font-bold">Settings</h2><label className="block">Playback volume: {Math.round(volume*100)}%<input aria-label="Playback volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={e=>setVolume(Number(e.target.value))} className="block w-full my-4"/></label><button className="px-4 py-3 bg-purple-600 rounded-lg" onClick={()=>setVolume(volume===0?0.7:0)}>{volume===0?'Unmute':'Mute'}</button><p className="text-gray-400">Volume, favorites, playlists, and your listener profile stay saved in this browser.</p><Link to="/profile" className="block text-purple-300">Edit listener profile</Link></section>;
}
export function NotificationsPage() {
  const {library,clearNotifications}=useLibrary();
  return <section className="space-y-4"><div className="flex justify-between gap-3"><h2 className="text-2xl font-bold">Notifications</h2><button onClick={clearNotifications} disabled={!library.notifications.length} className="text-purple-300 disabled:opacity-50">Clear notifications</button></div>{library.notifications.length?library.notifications.map(n=><article className="bg-white/5 rounded-xl p-4" key={n.id}><p>{n.message}</p><time className="text-sm text-gray-400">{new Date(n.time).toLocaleString()}</time></article>):<p className="text-gray-400">You're all caught up. Playlist, profile, and playback updates appear here.</p>}</section>;
}
export function AccountPage() {
  const [user,setUser]=useState<{username:string;email:string}|null>(()=>{try{return JSON.parse(sessionStorage.getItem('papzincrew:user')||'null');}catch{return null;}});
  const [mode,setMode]=useState<'login'|'register'>('login'); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const [identifier,setIdentifier]=useState(''); const [email,setEmail]=useState(''); const [username,setUsername]=useState(''); const [password,setPassword]=useState('');
  const request=async(path:string,body:object)=>{
    const response=await fetch(`${API_BASE}/auth/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json(); if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'Please check your details and try again.'); return data;
  };
  if(user) return <section className="space-y-4"><h2 className="text-2xl font-bold">Your account</h2><p>Signed in as {user.username}</p><p className="text-gray-400">{user.email}</p><Link to="/profile" className="block text-purple-300">Edit listener profile</Link><button className="bg-purple-600 rounded-lg px-4 py-3" onClick={()=>{sessionStorage.removeItem('papzincrew:token');sessionStorage.removeItem('papzincrew:user');setUser(null);window.dispatchEvent(new CustomEvent('account:changed'));}}>Log out</button></section>;
  return <form className="space-y-4 max-w-md" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try { if(mode==='register') await request('register',{email,username,password}); const data=await request('login',{identifier:mode==='register'?email:identifier,password});sessionStorage.setItem('papzincrew:token',data.access_token);sessionStorage.setItem('papzincrew:user',JSON.stringify(data.user));setUser(data.user);setPassword('');window.dispatchEvent(new CustomEvent('account:changed'));}catch(err){setError(err instanceof Error?err.message:'Unable to connect.');}finally{setBusy(false);}}}>
    <h2 className="text-2xl font-bold">{mode==='login'?'Sign in':'Create account'}</h2><p className="text-gray-400">Listening is open to everyone. Sign in to your PapzinCrew account here.</p>
    {mode==='register'?<><label className="block">Email<input className={input} type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="block">Username<input className={input} required minLength={3} maxLength={50} autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label></>:<label className="block">Email or username<input className={input} required autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)}/></label>}
    <label className="block">Password<input className={input} type="password" required minLength={mode==='register'?8:1} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {error&&<p role="alert" className="text-red-300">{error}</p>}<button disabled={busy} className="bg-purple-600 rounded-lg px-4 py-3 disabled:opacity-50">{busy?'Connecting…':mode==='login'?'Sign in':'Create account'}</button><button type="button" onClick={()=>{setMode(mode==='login'?'register':'login');setError('');}} className="block text-purple-300">{mode==='login'?'Create a new account':'Already registered? Sign in'}</button>
  </form>;
}
