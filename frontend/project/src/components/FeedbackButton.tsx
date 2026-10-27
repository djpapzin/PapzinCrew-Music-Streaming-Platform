import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { API_BASE } from '../lib/api';

export default function FeedbackButton() {
  const dialog=useRef<HTMLDialogElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const id=useRef('');
  const location=useLocation();
  const [message,setMessage]=useState('');
  const [name,setName]=useState('');
  const [website,setWebsite]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [sent,setSent]=useState(false);
  const [page,setPage]=useState('/');
  const close=()=>{dialog.current?.close();trigger.current?.focus();};
  async function submit(e:React.FormEvent) {
    e.preventDefault(); if(busy)return;
    setBusy(true);setError('');
    const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),15000);
    try {
      const response=await fetch(`${API_BASE}/feedback`,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id.current,message,name,website,page,device:window.matchMedia('(max-width: 767px)').matches?'mobile':'desktop'})});
      if(!response.ok)throw new Error(response.status===429?'Too many reports right now. Please try later.':'Could not send your report. Your message is kept here; please try again.');
      setSent(true);setMessage('');setName('');
    } catch(e){setError(e instanceof Error&&e.name!=='AbortError'?e.message:'Could not connect. Your message is kept here; please try again.');}
    finally{window.clearTimeout(timer);setBusy(false);}
  }
  return <><button ref={trigger} type="button" aria-label="Report a problem" onClick={()=>{if(sent){setSent(false);id.current='';}if(!id.current)id.current=crypto.randomUUID();setPage(location.pathname);dialog.current?.showModal();}} className="min-h-11 min-w-11 rounded-full px-2 hover:bg-white/10 flex items-center gap-1 text-sm"><MessageSquare className="w-4 h-4"/><span className="hidden sm:inline">Feedback</span></button>
    <dialog ref={dialog} aria-labelledby="feedback-title" onCancel={e=>{if(busy)e.preventDefault();}} onClose={()=>trigger.current?.focus()} className="m-auto w-[calc(100%_-_2rem)] max-w-md max-h-[85dvh] overflow-y-auto rounded-2xl border border-white/20 bg-gray-950 text-white p-5 backdrop:bg-black/70">
      <div className="flex items-center justify-between gap-3"><h2 id="feedback-title" className="text-lg font-semibold">Report a problem</h2><button type="button" disabled={busy} aria-label="Close feedback" onClick={close} className="min-h-11 min-w-11 rounded-full hover:bg-white/10">✕</button></div>
      {sent?<div role="status" className="space-y-4 py-3"><p>Thanks! Your feedback was sent privately to DJ Papzin.</p><button type="button" onClick={close} className="rounded bg-purple-600 px-4 py-3">Done</button></div>:<form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-gray-300">Still in beta—tell us what broke or felt confusing. No sign-in needed.</p>
        <label className="block text-sm">Your name (optional)<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} autoComplete="off" className="mt-1 block w-full rounded bg-white/10 p-3"/></label>
        <label className="block text-sm">What happened?<textarea autoFocus required minLength={10} maxLength={3000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Which mix? What did you tap, and what happened?" className="mt-1 block w-full min-h-32 rounded bg-white/10 p-3"/></label>
        <div hidden aria-hidden="true"><label>Website<input tabIndex={-1} value={website} onChange={e=>setWebsite(e.target.value)} autoComplete="off"/></label></div>
        <p className="text-xs text-gray-400">Page: {page}. Device type is included. Only the owner can read reports. Please don’t include passwords or private details.</p>
        {error&&<p role="alert" className="text-amber-200 text-sm">{error}</p>}
        <button disabled={busy||message.trim().length<10} className="w-full rounded bg-purple-600 p-3 disabled:opacity-50">{busy?'Sending…':'Send feedback'}</button>
      </form>}
    </dialog></>;
}
