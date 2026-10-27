import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../lib/api';
interface Report {id:string;message:string;name:string;page:string;device:string;created_at:string}
export default function FeedbackInbox({adminKey,ownerSession=false}:{adminKey:string;ownerSession?:boolean}) {
  const [reports,setReports]=useState<Report[]|null>(null);
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const generation=useRef(0);
  useEffect(()=>{generation.current++;setReports(null);setError('');setBusy(false);},[adminKey,ownerSession]);
  async function load() {
    const current=++generation.current;setBusy(true);setError('');
    try {
      const response=await fetch(`${API_BASE}/admin/feedback`,{headers:adminKey?{'X-Admin-Api-Key':adminKey}:{}});
      if(!response.ok)throw new Error('Could not load feedback. Check your owner key and try again.');
      const data=await response.json();if(current===generation.current)setReports(data.reports);
    }catch(e){if(current===generation.current){setReports(null);setError(e instanceof Error?e.message:'Could not load feedback.');}}
    finally{if(current===generation.current)setBusy(false);}
  }
  return <section className="rounded-xl border border-white/10 p-4 space-y-3"><h3 className="font-semibold">Tester feedback</h3><p className="text-sm text-gray-400">Private reports, newest first (latest 100). Nothing is emailed or published.</p><button disabled={(!adminKey&&!ownerSession)||busy} onClick={()=>void load()} className="rounded bg-white/10 px-4 py-3 disabled:opacity-50">{busy?'Loading feedback…':'Load feedback'}</button>{error&&<p role="alert" className="text-amber-200">{error}</p>}{reports?.length===0&&<p>No feedback yet.</p>}{reports?.map(report=><article key={report.id} className="rounded bg-white/5 p-3 space-y-2"><p className="text-sm text-gray-400">{report.name||'Anonymous'} · {report.device} · {new Date(report.created_at).toLocaleString()}</p><p className="text-sm break-all">Page: {report.page}</p><p className="whitespace-pre-wrap break-words">{report.message}</p></article>)}</section>;
}
