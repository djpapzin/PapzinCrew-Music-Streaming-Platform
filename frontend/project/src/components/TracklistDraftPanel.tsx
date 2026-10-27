import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../lib/api';
interface Draft { state:string; note:string; error?:string; entries:{seconds:number;artist:string;title:string;score:number|null}[] }
const time=(s:number)=>[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map((n,i)=>i===0?String(n):String(n).padStart(2,'0')).join(':');
export default function TracklistDraftPanel({adminKey}:{adminKey:string}) {
  const generation=useRef(0);
  const [mixId,setMixId]=useState('');
  const [draft,setDraft]=useState<Draft|null>(null);
  const [enabled,setEnabled]=useState(false);
  const [checked,setChecked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [copied,setCopied]=useState(false);
  const endpoint=`${API_BASE}/admin/tracklist-drafts/${mixId}`;
  async function request(generate=false) {
    if(!/^\d+$/.test(mixId)||!adminKey)return;
    const current=++generation.current;
    setBusy(true);setError('');
    try {
      const response=await fetch(endpoint,{method:generate?'POST':'GET',headers:{'X-Admin-Api-Key':adminKey}});
      const data=await response.json();
      if(current!==generation.current)return;
      if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'Unable to load the draft.');
      if(!generate){setEnabled(data.enabled);setChecked(true);}
      setDraft(data.draft);
    } catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Unable to load the draft.');}
    finally{if(current===generation.current)setBusy(false);}
  }
  useEffect(()=>{
    if(!draft||!['queued','scanning'].includes(draft.state))return;
    const timer=window.setTimeout(()=>void request(),4000);
    return()=>window.clearTimeout(timer);
  },[draft,mixId,adminKey]);
  useEffect(()=>{generation.current++;setBusy(false);setDraft(null);setChecked(false);setEnabled(false);setError('');setCopied(false);},[mixId,adminKey]);
  return <section className="rounded-xl border border-white/10 p-4 space-y-3">
    <h3 className="font-semibold">Suggested tracklists</h3>
    <p className="text-sm text-gray-400">Generate a private draft for review. Existing tracklists are preserved. Scans are manual and use configured free credits only.</p>
    <div className="flex gap-2"><input aria-label="Mix ID for tracklist" inputMode="numeric" value={mixId} onChange={e=>setMixId(e.target.value)} placeholder="Mix ID, e.g. 237" className="min-w-0 flex-1 rounded bg-white/10 p-3"/>
    <button disabled={busy||!adminKey||!/^\d+$/.test(mixId)} onClick={()=>void request()} className="rounded bg-white/10 px-3 disabled:opacity-50">Check draft</button></div>
    {checked&&!enabled&&<p role="status" className="text-amber-200 text-sm">Scanning is disabled. An AudD account, free credits and download allowance must be configured on the VPS first.</p>}
    {checked&&enabled&&!draft&&<><p className="text-sm text-gray-400">Samples up to the first 30 minutes at one sample per minute. AudD receives the audio file. Results may miss tracks or misidentify blends.</p><button disabled={busy} onClick={()=>void request(true)} className="rounded bg-purple-600 px-4 py-2 disabled:opacity-50">Generate suggested tracklist</button></>}
    {busy&&<p role="status">Loading…</p>}{error&&<p role="alert" className="text-amber-200">{error}</p>}
    {draft&&<><p className="font-medium">Draft: {draft.state.replace('_',' ')}</p><p className="text-sm text-gray-400">{draft.note}</p>{draft.error&&<p role="alert" className="text-amber-200">{draft.error}</p>}
    {draft.state==='no_matches'&&<p>No tracks were recognized. Your existing catalog is unchanged.</p>}
    {draft.entries.length>0&&<><ol className="space-y-2 text-sm">{draft.entries.map((entry,index)=><li key={index}><span className="text-purple-300 tabular-nums">{time(entry.seconds)}</span> {entry.artist} — {entry.title}{entry.score!==null&&<span className="text-gray-400"> · match score {entry.score}</span>}</li>)}</ol><button className="rounded bg-white/10 px-4 py-2" onClick={async()=>{try{await navigator.clipboard.writeText(draft.entries.map(e=>`${time(e.seconds)} ${e.artist} — ${e.title}`).join('\n'));setCopied(true);}catch{setError('Could not copy. Select the draft text manually.');}}}>{copied?'Copied':'Copy draft'}</button></>}
    <p className="text-xs text-gray-400">Suggestions are separate from the public tracklist. Nothing is published or overwritten here.</p></>}
  </section>;
}
