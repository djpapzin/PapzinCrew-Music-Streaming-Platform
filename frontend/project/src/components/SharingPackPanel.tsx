import {useEffect, useRef, useState} from 'react';
import {API_BASE} from '../lib/api';
type Mix = {id:number;title:string;artist:string};
type Pack = Mix & {fingerprint:string;url:string;short:string;long:string;credit_note:string};
export default function SharingPackPanel() {
  const [mixes,setMixes]=useState<Mix[]>([]), [search,setSearch]=useState('');
  const [id,setId]=useState(''), [pack,setPack]=useState<Pack|null>(null);
  const [short,setShort]=useState(''), [long,setLong]=useState('');
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [message,setMessage]=useState('');
  const [stale,setStale]=useState(false); const generation=useRef(0);
  useEffect(()=>{let active=true;
    void fetch(`${API_BASE}/admin/sharing`,{cache:'no-store'}).then(async r=>{
      if(!r.ok)throw new Error('Unable to load sharing mixes. Refresh owner access.');
      const data=await r.json();if(!Array.isArray(data.mixes))throw new Error('Unable to load sharing mixes. Refresh owner access.');
      if(active)setMixes(data.mixes);
    }).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;generation.current++;};
  },[]);
  async function load() {
    const current=++generation.current;setBusy(true);setError('');setMessage('');
    try {const r=await fetch(`${API_BASE}/admin/sharing/${id}`,{cache:'no-store'});
      if(!r.ok)throw new Error('This mix is unavailable or owner access expired. Your edits are retained.');
      const data:Pack=await r.json();if(current!==generation.current)return;
      setPack(data);setShort(data.short);setLong(data.long);setStale(false);
    }catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Unable to load mix.');}
    finally{if(current===generation.current)setBusy(false);}
  }
  function copy(text:string) {
    if(!pack)return;const selected=pack;const current=++generation.current;
    setBusy(true);setError('');setMessage('');
    void (async()=>{try {
      if(typeof ClipboardItem==='undefined'||!navigator.clipboard?.write)throw new Error('Validated clipboard copy is unavailable in this browser. Try a supported browser.');
      const validated=(async()=>{
        const r=await fetch(`${API_BASE}/admin/sharing/${selected.id}`,{cache:'no-store'});
        if(!r.ok){if(current===generation.current)setStale(true);throw new Error('Public availability or owner access changed. Copy blocked; edits retained.');}
        const data:Pack=await r.json();
        if(current!==generation.current)throw new Error('Selected mix changed.');
        if(data.fingerprint!==selected.fingerprint){setStale(true);throw new Error('Catalog details changed. Edits retained; review them before regenerating.');}
        return new Blob([text],{type:'text/plain'});
      })();void validated.catch(()=>{});
      await navigator.clipboard.write([new ClipboardItem({'text/plain':validated})]);
      if(current===generation.current)setMessage('Draft copied. Review credits and obtain destination approval before sending.');
    }catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Copy failed; edits retained.');}
    finally{if(current===generation.current)setBusy(false);}})();
  }
  return <section aria-label="Existing mix sharing" className="space-y-3 rounded-2xl border border-cyan-400/20 bg-slate-950 p-4 min-w-0">
    <h3 className="text-lg font-semibold">Existing mix sharing</h3>
    <p className="text-sm text-slate-300">Owner drafts for published mixes. Nothing is posted or scheduled here. Edits last until you leave this page.</p>
    <label className="block">Find a public mix<input className="block w-full rounded bg-slate-800 p-3" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <label className="block">Public mix<select className="block w-full rounded bg-slate-800 p-3" value={id} disabled={busy} onChange={e=>{generation.current++;setId(e.target.value);setPack(null);setStale(false);setError('');setMessage('');}}>
      <option value="">Choose a mix</option>{mixes.filter(m=>String(m.id)===id||`${m.title} ${m.artist}`.toLowerCase().includes(search.toLowerCase())).map(m=><option key={m.id} value={m.id}>#{m.id} · {m.title} — {m.artist}</option>)}
    </select></label>
    <button disabled={!id||busy||!!pack} onClick={()=>void load()} className="min-h-11 rounded bg-cyan-800 px-4 disabled:opacity-50">Prepare drafts</button>
    {error&&<p role="alert" className="text-amber-200">{error}</p>}{message&&<p role="status">{message}</p>}
    {pack&&<fieldset disabled={busy} className="space-y-3 min-w-0">
      <legend>{pack.title} — {pack.artist}</legend><a className="break-all text-cyan-300 underline" href={pack.url} target="_blank" rel="noreferrer">{pack.url}</a>
      <p className="text-sm">{pack.credit_note} Handles are not supplied.</p>
      {stale&&<p role="alert">Draft is stale. Copy your edits somewhere safe, then explicitly regenerate from the current catalog.</p>}
      <label className="block">Short announcement draft<textarea className="block w-full rounded bg-slate-800 p-3" rows={4} maxLength={3000} value={short} onChange={e=>setShort(e.target.value)}/></label>
      <button disabled={stale||!short.trim()} onClick={()=>copy(short)} className="min-h-11 rounded bg-slate-700 px-4 disabled:opacity-50">Validate and copy short draft</button>
      <label className="block">Long announcement draft<textarea className="block w-full rounded bg-slate-800 p-3" rows={6} maxLength={3000} value={long} onChange={e=>setLong(e.target.value)}/></label>
      <button disabled={stale||!long.trim()} onClick={()=>copy(long)} className="min-h-11 rounded bg-slate-700 px-4 disabled:opacity-50">Validate and copy long draft</button>
      <button onClick={()=>{if(window.confirm('Replace both edited drafts with current catalog templates?'))void load();}} className="min-h-11 rounded bg-slate-800 px-4">Regenerate both drafts (replaces edits)</button>
    </fieldset>}
  </section>;
}
