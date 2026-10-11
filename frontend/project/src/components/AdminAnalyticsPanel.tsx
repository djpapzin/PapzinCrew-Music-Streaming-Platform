import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import ProtectedAdminAnalyticsPanel from './ProtectedAdminAnalyticsPanel';
interface Summary {total_tracks:number;total_duration_hours:number;total_storage_mb:number;total_artists:number}
export default function AdminAnalyticsPanel() {
  const [data,setData]=useState<Summary|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const load=async()=>{setBusy(true);setError('');try {const response=await fetch(`${API_BASE}/tracks/catalog-summary`);if(!response.ok)throw new Error('Catalog totals are temporarily unavailable. Please retry.');setData(await response.json());}catch(err){setError(err instanceof Error?err.message:'Unable to connect.');}finally{setBusy(false);}};
  useEffect(()=>{void load();},[]);
  return <section className="space-y-5"><div className="flex justify-between gap-4"><div><h2 className="text-2xl font-bold">Catalog overview</h2><p className="text-gray-400 mt-2">Live totals for publicly available music.</p></div><button disabled={busy} onClick={load} className="rounded-lg bg-purple-600 px-4 py-2 disabled:opacity-50">Refresh</button></div>{busy&&<p role="status">Loading catalog totals…</p>}{error&&<p role="alert" className="text-amber-200">{error}</p>}{data&&!busy&&<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[['Tracks',data.total_tracks],['Artists',data.total_artists],['Hours of music',data.total_duration_hours],['Storage (MB)',data.total_storage_mb]].map(([label,value])=><article className="rounded-xl bg-white/5 p-5" key={label}><p className="text-gray-400">{label}</p><p className="text-2xl font-bold mt-2">{value}</p></article>)}</div>}<details className="border border-white/10 rounded-xl p-4"><summary className="cursor-pointer font-semibold">Owner analytics</summary><div className="pt-5"><ProtectedAdminAnalyticsPanel/></div></details></section>;
}
