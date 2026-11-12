import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../lib/api';

type Checks = Record<string, boolean>;
interface Release {
  id:number; title:string; artist:string; cover_art_url:string; duration_seconds:number;
  tracklist:string; review_url:string; fingerprint:string; revision:number;
  stale:boolean; test_only:boolean; checks:Checks; notes:string; caption:string;
  release_time:string; final_approved:boolean; approved_at:string|null;
}
const labels:Record<string,string> = {
  audio_ready:'Release-ready audio confirmed', title_credit_approved:'Title and guest credit approved',
  presentation_approved:'Artwork or presentation approved', playback_verified:'Muted playback, seeking and hidden discovery checked',
  musical_approved:'DJ Papzin completed the private musical review',
};
export default function GuestReleasePanel() {
  const [queue,setQueue]=useState<{id:number;title:string;artist:string;test_only:boolean}[]>([]);
  const [queueVersion,setQueueVersion]=useState(0);
  const [mixId,setMixId]=useState(''); const [release,setRelease]=useState<Release|null>(null);
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [message,setMessage]=useState('');
  const generation=useRef(0);
  useEffect(()=>{
    let active=true;
    void fetch(`${API_BASE}/admin/releases`,{cache:'no-store'}).then(async r=>{
      if(!r.ok)throw new Error('Unable to load the release queue. Refresh owner access and try again.');
      const data=await r.json();if(active)setQueue(data.mixes||[]);
    }).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;generation.current++;};
  },[queueVersion]);
  async function load() {
    if(!mixId)return;
    const current=++generation.current;setBusy(true);setError('');setMessage('');
    try {
      const r=await fetch(`${API_BASE}/admin/releases/${mixId}`,{cache:'no-store'});const data=await r.json();
      if(current!==generation.current)return;
      if(!r.ok)throw new Error(typeof data.detail==='string'?data.detail:'Unable to load this release.');
      setRelease(data);
    } catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Unable to load this release.');}
    finally{if(current===generation.current)setBusy(false);}
  }
  async function save(approve=false) {
    if(!release)return;
    const current=++generation.current;setBusy(true);setError('');setMessage('');
    const {fingerprint,revision,notes,caption,release_time,checks}=release;
    try {
      const r=await fetch(`${API_BASE}/admin/releases/${release.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({fingerprint,revision,notes,caption,release_time,...checks,final_approved:approve})});
      const data=await r.json();if(current!==generation.current)return;
      if(!r.ok)throw new Error(typeof data.detail==='string'?data.detail:'Unable to save. Keep your notes and try again.');
      setRelease(data);setMessage(approve?'Final approval recorded. The mix remains unlisted.':'Private review saved.');
    } catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Unable to save. Keep your notes.');}
    finally{if(current===generation.current)setBusy(false);}
  }
  async function copyDraft() {
    if(!release)return;
    const current=++generation.current;setBusy(true);setError('');setMessage('');
    try {
      const r=await fetch(`${API_BASE}/admin/releases/${release.id}`,{cache:'no-store'});const data=await r.json();
      if(current!==generation.current)return;
      if(!r.ok)throw new Error('Owner access is required to copy the current approved draft.');
      if(!data.final_approved||data.fingerprint!==release.fingerprint||data.revision!==release.revision)
        throw new Error('This review changed. Reload and approve the current version before copying.');
      await navigator.clipboard.writeText(data.caption);
      if(current===generation.current)setMessage('Announcement draft copied. Send only after publication and destination approval.');
    } catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Copy failed. Reload the review and try again.');}
    finally{if(current===generation.current)setBusy(false);}
  }
  function edit(values:Partial<Release>) { setRelease(r=>r?{...r,...values,final_approved:false}:r);setMessage(''); }
  const allChecked=release&&Object.keys(labels).every(key=>release.checks[key]);
  return <section aria-label="Guest release desk" className="space-y-4 rounded-2xl border border-purple-400/20 bg-slate-950 p-4">
    <h3 className="text-lg font-semibold">Guest release desk</h3>
    <p className="text-sm text-slate-300">Private owner review and announcement drafts. Tracklists and other platform links are optional. Publication and sending require separate approval.</p>
    <button disabled={busy} onClick={()=>{setError('');setQueueVersion(v=>v+1);}} className="min-h-11 rounded bg-slate-800 px-4">Refresh release queue</button>
    <div className="flex flex-wrap gap-3">
      <label className="flex-1 min-w-0">Unlisted mix<select aria-label="Unlisted mix" value={mixId} disabled={busy} onChange={e=>{
        generation.current++;setMixId(e.target.value);setRelease(null);setError('');setMessage('');
      }} className="block w-full bg-slate-800 p-3 rounded">
        <option value="">Choose a mix</option>{queue.map(m=><option key={m.id} value={m.id}>#{m.id} · {m.title} — {m.artist}{m.test_only?' · TEST ONLY':''}</option>)}
      </select></label>
      <button disabled={!mixId||busy} onClick={()=>void load()} className="min-h-11 rounded bg-purple-700 px-4 disabled:opacity-50">{busy?'Working…':'Load review'}</button>
    </div>
    {error&&<p role="alert" className="text-amber-200">{error}</p>}{message&&<p role="status" className="text-green-200">{message}</p>}
    {release&&<fieldset disabled={busy} className="space-y-4 min-w-0">
      <legend className="font-semibold">{release.title} — {release.artist}</legend>
      <p className="text-sm">{Math.floor(release.duration_seconds/60)}:{String(release.duration_seconds%60).padStart(2,'0')} · Unlisted</p>
      <a href={release.review_url} target="_blank" rel="noreferrer" className="text-cyan-300 underline">Open unlisted review</a>
      <p className="text-xs text-slate-400">Anyone with that link can listen. Keep it out of groups until publication is approved. Check the selected cover on the review page.</p>
      {release.stale&&<p role="alert" className="text-amber-200">The mix changed since its last review. Checks and final approval have been reset; review the current audio and metadata.</p>}
      {release.test_only&&<p className="text-amber-200">TEST ONLY — this upload cannot receive final release approval.</p>}
      {Object.entries(labels).map(([key,label])=><label key={key} className="flex gap-3 items-start py-1"><input type="checkbox" className="mt-1" checked={!!release.checks[key]} onChange={e=>edit({checks:{...release.checks,[key]:e.target.checked}})}/>{label}</label>)}
      <label className="block">Private review notes<textarea value={release.notes} maxLength={3000} onChange={e=>edit({notes:e.target.value})} className="mt-1 block w-full rounded bg-slate-800 p-3"/></label>
      <label className="block">Release time (SAST, optional)<input value={release.release_time} maxLength={100} onChange={e=>edit({release_time:e.target.value})} className="mt-1 block w-full rounded bg-slate-800 p-3"/></label>
      <details><summary>Supplied tracklist (optional)</summary><p className="whitespace-pre-wrap text-sm">{release.tracklist||'No tracklist supplied. This does not block approval.'}</p></details>
      <label className="block">Announcement draft<textarea rows={5} value={release.caption} maxLength={3000} onChange={e=>edit({caption:e.target.value})} className="mt-1 block w-full rounded bg-slate-800 p-3"/></label>
      <p className="text-xs text-slate-400">Draft only. Confirm the canonical link is public and working before sharing. No release is scheduled here.</p>
      <div className="flex flex-wrap gap-3">
        <button onClick={()=>void save()} className="min-h-11 rounded bg-slate-700 px-4">Save private review</button>
        <button disabled={!allChecked||release.test_only} onClick={()=>void save(true)} className="min-h-11 rounded bg-purple-700 px-4 disabled:opacity-50">Record final approval</button>
        <button disabled={!release.final_approved} onClick={()=>void copyDraft()} className="min-h-11 rounded bg-slate-700 px-4 disabled:opacity-50">Copy approved draft</button>
      </div>
      {release.final_approved&&<p className="text-green-200">Final approval recorded for this version. Still unlisted; publishing is a separate action.</p>}
    </fieldset>}
  </section>;
}
