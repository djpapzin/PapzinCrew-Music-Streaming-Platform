import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { API_BASE } from '../lib/api';

const categories=[['problem','Something broke'],['idea','An idea'],['improvement','Improve something'],['removal','Remove something'],['other','Something else']] as const;

export default function FeedbackButton() {
  const dialog=useRef<HTMLDialogElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const id=useRef('');
  const location=useLocation();
  const [message,setMessage]=useState('');
  const [name,setName]=useState('');
  const [category,setCategory]=useState('other');
  const [website,setWebsite]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [sent,setSent]=useState(false);
  const [page,setPage]=useState('/');
  useEffect(()=>{dialog.current?.close();setPage(location.pathname);},[location.key]);
  const close=()=>{dialog.current?.close();trigger.current?.focus();};
  async function submit(e:React.FormEvent) {
    e.preventDefault(); if(busy)return;
    setBusy(true);setError('');
    const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch(`${API_BASE}/feedback`,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id.current,message,name,category,website,page,device:window.matchMedia('(max-width: 767px)').matches?'mobile':'desktop'})});
      if(!response.ok)throw new Error(response.status===429?'Too many reports right now. Please try later.':'Could not send your report. Your message is kept here; please try again.');
      setSent(true);setMessage('');setName('');setCategory('other');
    } catch(e){setError(e instanceof Error&&e.name!=='AbortError'?e.message:'Could not connect. Your message is kept here; please try again.');}
    finally{window.clearTimeout(timer);setBusy(false);}
  }
  return <><button ref={trigger} type="button" aria-label="Send feedback" onClick={()=>{if(sent){setSent(false);id.current='';}if(!id.current)id.current=crypto.randomUUID();setPage(location.pathname);dialog.current?.showModal();}} className="min-h-11 min-w-11 rounded-full px-2 hover:bg-white/10 flex items-center gap-1 text-sm"><MessageSquare className="w-4 h-4"/><span>Feedback</span></button>
    <dialog ref={dialog} aria-labelledby="feedback-title" onCancel={e=>{if(busy)e.preventDefault();}} onClose={()=>trigger.current?.focus()} className="m-auto w-[calc(100%_-_2rem)] max-w-md max-h-[85dvh] overflow-y-auto rounded-2xl border border-white/20 bg-gray-950 text-white p-5 backdrop:bg-black/70">
      <div className="flex items-center justify-between gap-3"><h2 id="feedback-title" className="text-lg font-semibold">Tell DJ Papzin</h2><button type="button" disabled={busy} aria-label="Close feedback" onClick={close} className="min-h-11 min-w-11 rounded-full hover:bg-white/10">✕</button></div>
      {sent?<div role="status" className="space-y-4 py-3"><p>Thanks! Your feedback was sent privately to DJ Papzin.</p><button type="button" onClick={close} className="rounded bg-purple-600 px-4 py-3">Done</button></div>:<form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-gray-300">Something broken, an idea, or something we should change? One quick message is enough. No account needed.</p>
        <fieldset><legend className="text-sm mb-2">What is it about?</legend><div className="flex flex-wrap gap-2">{categories.map(([value,label])=><button key={value} type="button" aria-pressed={category===value} onClick={()=>setCategory(value)} className={`min-h-11 rounded-full border px-3 text-sm ${category===value?'bg-purple-600 border-purple-400':'border-white/20 bg-white/5'}`}>{label}</button>)}</div></fieldset>
        <label className="block text-sm">Your message<textarea autoFocus required minLength={3} maxLength={3000} value={message} onChange={e=>setMessage(e.target.value)} placeholder={category==='problem'?'What did you try, and what went wrong?':category==='removal'?'What should we remove, and why?':'What would make Papzin & Crew better for you?'} className="mt-1 block w-full min-h-24 rounded bg-white/10 p-3"/></label>
        <details><summary className="text-sm cursor-pointer min-h-11 flex items-center">Add your name (optional)</summary><label className="block text-sm">Your name<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} autoComplete="off" className="mt-1 block w-full rounded bg-white/10 p-3"/></label></details>
        <div hidden aria-hidden="true"><label>Website<input tabIndex={-1} value={website} onChange={e=>setWebsite(e.target.value)} autoComplete="off"/></label></div>
        <p className="text-xs text-gray-400">Page: {page}. Only DJ Papzin can read this. Please don’t include passwords or private details.</p>
        {error&&<p role="alert" className="text-amber-200 text-sm">{error}</p>}
        <button disabled={busy||message.trim().length<3} className="w-full rounded bg-purple-600 p-3 disabled:opacity-50">{busy?'Sending…':'Send feedback'}</button>
      </form>}
    </dialog></>;
}
