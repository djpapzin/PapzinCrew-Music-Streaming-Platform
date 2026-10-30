import {useEffect,useRef,useState} from 'react';
import {API_BASE} from '../lib/api';
interface DownloadRow{id:number;title:string;requests:number}
export default function DownloadStats({adminKey,ownerSession=false}:{adminKey:string;ownerSession?:boolean}){
 const [activity,setActivity]=useState('listener');
 const generation=useRef(0);const [rows,setRows]=useState<DownloadRow[]|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [query,setQuery]=useState('');
 useEffect(()=>{generation.current++;setRows(null);setError('');setBusy(false);if(ownerSession)void load();},[adminKey,ownerSession,activity]);
 async function load(){const current=++generation.current;setBusy(true);setError('');try{
  const response=await fetch(`${API_BASE}/admin/downloads?activity=${activity}`,{headers:adminKey?{'X-Admin-Api-Key':adminKey}:{}});
  if(!response.ok)throw new Error('Could not load private download counts. Check your owner access.');
  const data=await response.json();if(!Array.isArray(data.mixes))throw new Error('Download counts are temporarily unavailable.');
  if(current===generation.current)setRows(data.mixes);
 }catch(e){if(current===generation.current){setRows(null);setError(e instanceof Error?e.message:'Could not load download counts.');}}finally{if(current===generation.current)setBusy(false);}}
 return <section className="rounded-xl border border-white/10 p-4 space-y-3"><h3 className="font-semibold">Download requests</h3><label className="block text-sm">Activity <select aria-label="Activity category" className="bg-gray-800 rounded p-2" value={activity} onChange={e=>setActivity(e.target.value)}><option value="listener">Listeners (since tracking update)</option><option value="test">Tests (since tracking update)</option><option value="legacy">Earlier activity — includes tests</option></select></label>
  <p className="text-sm text-gray-400">All-time server request starts, not unique people or confirmed completed files. HEAD checks and resumed byte ranges do not add a new start. Test mode downloads are separate; no visitor identities are stored.</p>
  <button disabled={(!adminKey&&!ownerSession)||busy} onClick={()=>void load()} className="rounded bg-white/10 px-4 py-3 disabled:opacity-50">{busy?'Loading downloads…':'Refresh download counts'}</button>
  {error&&<p role="alert">{error}</p>}
  {rows&&<><p>Total download requests: {rows.reduce((sum,row)=>sum+row.requests,0)}</p><label className="block">Find a mix<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Mix title" className="block w-full rounded bg-white/10 p-3 mt-2" /></label>
  <div className="max-h-80 overflow-auto"><table className="w-full text-sm text-left"><caption className="text-left text-gray-400 py-2">Public mixes · lifetime download requests</caption><thead><tr><th>Mix</th><th>Requests</th></tr></thead><tbody>{rows.filter(row=>row.title.toLowerCase().includes(query.toLowerCase())).map(row=><tr key={row.id}><td>{row.title}</td><td>{row.requests}</td></tr>)}</tbody></table></div></>}
 </section>;
}
