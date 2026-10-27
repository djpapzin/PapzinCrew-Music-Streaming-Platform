import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../lib/api';
interface Draft { state:string; note:string; error?:string; entries:{seconds:number;artist:string;title:string;score:number|null}[] }
const time=(s:number)=>[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map((n,i)=>i===0?String(n):String(n).padStart(2,'0')).join(':');
export default function TracklistDraftPanel({adminKey,ownerSession=false}:{adminKey:string;ownerSession?:boolean}) {
  const generation=useRef(0);
  const [mixId,setMixId]=useState('');
  const [provider,setProvider]=useState('shazamio');
  const [manual,setManual]=useState('');
  const [providerNote,setProviderNote]=useState('');
  const [draft,setDraft]=useState<Draft|null>(null);
  const [enabled,setEnabled]=useState(false);
  const [checked,setChecked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [copied,setCopied]=useState(false);
  const endpoint=`${API_BASE}/admin/tracklist-drafts/${mixId}?provider=${provider}`;
  async function request(generate=false) {
    if(!/^\d+$/.test(mixId)||(!adminKey&&!ownerSession))return;
    const current=++generation.current;
    setBusy(true);setError('');
    try {
      const response=await fetch(endpoint,{method:generate?'POST':'GET',headers:{...(adminKey?{'X-Admin-Api-Key':adminKey}:{}),...(generate?{'Content-Type':'application/json'}:{})},...(generate?{body:JSON.stringify({text:manual})}:{})});
      const data=await response.json();
      if(current!==generation.current)return;
      if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'Unable to load the draft.');
      if(!generate){setEnabled(provider!=='audd'&&data.enabled);setProviderNote(data.providers?.find((p:{id:string;note:string})=>p.id===provider)?.note||'Saved AudD drafts are view only.');setChecked(true);}
      setDraft(data.draft);
    } catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Unable to load the draft.');}
    finally{if(current===generation.current)setBusy(false);}
  }
  useEffect(()=>{
    if(!draft||!['queued','scanning'].includes(draft.state))return;
    const timer=window.setTimeout(()=>void request(),4000);
    return()=>window.clearTimeout(timer);
  },[draft,mixId,adminKey,provider]);
  useEffect(()=>{generation.current++;setBusy(false);setDraft(null);setChecked(false);setEnabled(false);setError('');setCopied(false);setManual('');setProviderNote('');},[mixId,adminKey,ownerSession,provider]);
  return <section className="rounded-xl border border-white/10 p-4 space-y-3">
    <h3 className="font-semibold">Suggested tracklists</h3>
    <p className="text-sm text-gray-400">Generate a private draft for review. Existing tracklists are preserved. Scans are manual, bounded and free. There is no automatic provider switch or publishing.</p>
    <label className="block text-sm">Suggestion source<select aria-label="Tracklist source" value={provider} onChange={e=>setProvider(e.target.value)} className="block w-full rounded bg-gray-800 p-3 mt-1"><option value="shazamio">ShazamIO (free, unofficial)</option><option value="local">Local reference library</option><option value="manual">DJ / manual suggestions</option><option value="audd">Saved AudD draft (view only)</option></select></label>
    <div className="flex gap-2"><input aria-label="Mix ID for tracklist" inputMode="numeric" value={mixId} onChange={e=>setMixId(e.target.value)} placeholder="Mix ID, e.g. 237" className="min-w-0 flex-1 rounded bg-white/10 p-3"/>
    <button disabled={busy||(!adminKey&&!ownerSession)||!/^\d+$/.test(mixId)} onClick={()=>void request()} className="rounded bg-white/10 px-3 disabled:opacity-50">Check draft</button></div>
    {checked&&<p className="text-sm text-gray-400">{providerNote}</p>}
    {checked&&!enabled&&provider!=='audd'&&<p role="status" className="text-amber-200 text-sm">This free option is unavailable or its allowance is exhausted. Local matching needs your reference library. Manual suggestions remain available.</p>}
    {checked&&enabled&&!draft&&<>{provider==='manual'&&<textarea aria-label="Manual tracklist suggestions" value={manual} onChange={e=>setManual(e.target.value)} placeholder="00:00 Artist — Title" className="w-full min-h-32 rounded bg-white/10 p-3"/>}<button disabled={busy||(provider==='manual'&&!manual.trim())} onClick={()=>void request(true)} className="rounded bg-purple-600 px-4 py-2 disabled:opacity-50">{provider==='manual'?'Save private suggestions':'Generate suggested tracklist'}</button></>}
    {busy&&<p role="status">Loading…</p>}{error&&<p role="alert" className="text-amber-200">{error}</p>}
    {draft&&<><p className="font-medium">Draft: {draft.state.replace('_',' ')}</p><p className="text-sm text-gray-400">{draft.note}</p>{draft.error&&<p role="alert" className="text-amber-200">{draft.error}</p>}
    {draft.state==='no_matches'&&<p>No tracks were recognized. Your existing catalog is unchanged.</p>}
    {draft.entries.length>0&&<><ol className="space-y-2 text-sm">{draft.entries.map((entry,index)=><li key={index}><span className="text-purple-300 tabular-nums">{time(entry.seconds)}</span> {entry.artist} — {entry.title}{entry.score!==null&&<span className="text-gray-400"> · match score {entry.score}</span>}</li>)}</ol><button className="rounded bg-white/10 px-4 py-2" onClick={async()=>{try{await navigator.clipboard.writeText(draft.entries.map(e=>`${time(e.seconds)} ${e.artist} — ${e.title}`).join('\n'));setCopied(true);}catch{setError('Could not copy. Select the draft text manually.');}}}>{copied?'Copied':'Copy draft'}</button></>}
    <p className="text-xs text-gray-400">Suggestions are separate from the public tracklist. Nothing is published or overwritten here.</p></>}
  </section>;
}
