import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../lib/api';
interface Report {id:string;message:string;name:string;page:string;device:string;created_at:string;category?:string;status?:string}
const categoryLabels:Record<string,string>={problem:'Something broke',idea:'An idea',improvement:'Improve something',removal:'Remove something',other:'Something else'};
export default function FeedbackInbox({adminKey,ownerSession=false}:{adminKey:string;ownerSession?:boolean}) {
  const [reports,setReports]=useState<Report[]|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const generation=useRef(0);
  const [status,setStatus]=useState('all');const [category,setCategory]=useState('all');const [saving,setSaving]=useState<string|null>(null);
  useEffect(()=>{generation.current++;setReports(null);setError('');setBusy(false);setSaving(null);if(adminKey||ownerSession)void load();},[adminKey,ownerSession]);
  const headers=()=>adminKey?{'X-Admin-Api-Key':adminKey}:{};
  async function load() {
    const current=++generation.current;setBusy(true);setError('');
    try {
      const response=await fetch(`${API_BASE}/admin/feedback`,{headers:headers()});
      if(!response.ok)throw new Error('Could not load feedback. Unlock owner access and try again.');
      const data=await response.json();if(current===generation.current)setReports(data.reports||[]);
    }catch(e){if(current===generation.current){setReports(null);setError(e instanceof Error?e.message:'Could not load feedback.');}}
    finally{if(current===generation.current)setBusy(false);}
  }
  async function update(report:Report,next:string) {
    const current=generation.current;setSaving(report.id);setError('');
    try {
      const response=await fetch(`${API_BASE}/admin/feedback/${report.id}`,{method:'PATCH',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({status:next})});
      if(!response.ok)throw new Error('Could not update this feedback. Please try again.');
      const data=await response.json();
      if(current===generation.current)setReports(items=>items?.map(item=>item.id===report.id?data.report:item)||[]);
    }catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Could not update feedback.');}
    finally{if(current===generation.current)setSaving(null);}
  }
  const visible=reports?.filter(report=>(status==='all'||(report.status||'new')===status)&&(category==='all'||(report.category||'problem')===category));
  return <section className="rounded-xl border border-white/10 p-4 space-y-3">
    <h3 className="font-semibold">Listener feedback</h3>
    <p className="text-sm text-gray-400">Private messages, newest first (latest 100). Nothing is emailed or published.</p>
    {reports&&<p className="text-sm text-purple-200">{reports.filter(r=>(r.status||'new')==='new').length} new · {reports.filter(r=>r.status==='reviewed').length} reviewed · {reports.filter(r=>r.status==='done').length} done</p>}
    <div className="flex flex-wrap gap-3 items-end">
      <label className="text-sm">Status<select aria-label="Feedback status" value={status} onChange={e=>setStatus(e.target.value)} className="block bg-gray-900 rounded p-3 min-h-11"><option value="all">All</option><option value="new">New</option><option value="reviewed">Reviewed</option><option value="done">Done</option></select></label>
      <label className="text-sm">Category<select aria-label="Feedback category" value={category} onChange={e=>setCategory(e.target.value)} className="block bg-gray-900 rounded p-3 min-h-11"><option value="all">All categories</option>{Object.entries(categoryLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <button disabled={(!adminKey&&!ownerSession)||busy||saving!==null} onClick={()=>void load()} className="rounded bg-white/10 px-4 py-3 disabled:opacity-50">{busy?'Loading feedback…':'Refresh feedback'}</button>
    </div>
    {error&&<p role="alert" className="text-amber-200">{error}</p>}
    {visible?.length===0&&<p>{reports?.length?'No feedback matches these filters.':'No feedback yet.'}</p>}
    {visible?.map(report=><article key={report.id} className="rounded bg-white/5 p-3 space-y-2">
      <p className="text-sm text-purple-200">{categoryLabels[report.category||'problem']||'Something else'} · {report.status||'new'}</p>
      <p className="text-sm text-gray-400">{report.name||'Anonymous'} · {report.device} · {new Date(report.created_at).toLocaleString()}</p>
      <p className="text-sm break-all">Page: {report.page}</p><p className="whitespace-pre-wrap break-words">{report.message}</p>
      <div className="flex flex-wrap gap-2">{['new','reviewed','done'].filter(next=>next!==(report.status||'new')).map(next=><button key={next} disabled={saving!==null} onClick={()=>void update(report,next)} className="rounded bg-white/10 px-3 py-3 text-sm disabled:opacity-50">{saving===report.id?'Saving…':next==='new'?'Reopen':next==='reviewed'?'Mark reviewed':'Mark done'}</button>)}</div>
    </article>)}
  </section>;
}
