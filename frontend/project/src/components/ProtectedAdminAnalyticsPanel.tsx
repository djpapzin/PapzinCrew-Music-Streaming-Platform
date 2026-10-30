import DownloadStats from './DownloadStats';
import AnonymousStats from './AnonymousStats';
import FeedbackInbox from './FeedbackInbox';
import TracklistDraftPanel from './TracklistDraftPanel';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, BarChart3, Download, HardDrive, Loader2, PlayCircle } from 'lucide-react';
import PaperclipInsightCard, { type PaperclipSummary } from './PaperclipInsightCard';
import { API_BASE } from '../lib/api';

interface AdminAnalyticsResponse {
  total_plays: number;
  total_downloads: number;
  total_storage_mb: number;
  paperclip_summary?: PaperclipSummary | null;
}

const stats = [
  { key: 'total_plays', label: 'Legacy stream requests', icon: PlayCircle },
  { key: 'total_downloads', label: 'Download requests', icon: Download },
  { key: 'total_storage_mb', label: 'Storage (MB)', icon: HardDrive },
] as const;

export default function ProtectedAdminAnalyticsPanel() {
  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adminKey, setAdminKey] = useState('');
  const authGeneration=useRef(0);
  const [ownerSession,setOwnerSession]=useState(false);
  const [remember,setRemember]=useState(false);
  const [unlocking,setUnlocking]=useState(false);
  useEffect(()=>{let active=true;const generation=authGeneration.current;void fetch(`${API_BASE}/admin/session`,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(active&&generation===authGeneration.current)setOwnerSession(data?.authenticated===true);}).catch(()=>{});return()=>{active=false;};},[]);
  async function unlock(){authGeneration.current++;setUnlocking(true);setError(null);try{const response=await fetch(`${API_BASE}/admin/session?remember=${remember}`,{method:'POST',headers:{'X-Admin-Api-Key':adminKey}});if(!response.ok)throw new Error('Could not unlock admin. Check your owner key and try again.');setOwnerSession(true);setAdminKey('');}catch(e){setError(e instanceof Error?e.message:'Could not unlock admin.');}finally{setUnlocking(false);}}
  async function signOut(){authGeneration.current++;setUnlocking(true);setError(null);try{const response=await fetch(`${API_BASE}/admin/session`,{method:'DELETE'});if(!response.ok)throw new Error('Could not sign out. Please try again.');setOwnerSession(false);setAdminKey('');setData(null);}catch(e){setError(e instanceof Error?e.message:'Could not sign out.');}finally{setUnlocking(false);}}


  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/admin/analytics`, {
        headers: adminKey ? { 'X-Admin-Api-Key': adminKey } : {},
      });

      if (!response.ok) {
        throw new Error(response.status === 403
          ? 'The owner key is missing or invalid.'
          : response.status === 503 ? 'Owner analytics need a private access key configured on the server.' : `Unable to load owner analytics (${response.status}).`);
      }

      const payload = (await response.json()) as AdminAnalyticsResponse;
      setData(payload);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Unable to load admin analytics.');
    } finally {
      setLoading(false);
    }
  }, [adminKey]);


  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-slate-950 to-slate-900 p-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-cyan-300">
            <BarChart3 className="h-4 w-4" />
            Admin analytics
          </div>
          <h2 className="text-lg font-semibold text-white">Publish + ops snapshot</h2>
          <p className="mt-1 text-sm text-slate-300">Private listening stats, download requests, and owner operations. Unlock once; optionally remember this private device for 30 days.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadAnalytics()}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
        >
          Refresh owner analytics
        </button>
      </div>

      {ownerSession?<div className="rounded-xl border border-green-400/20 p-4 flex flex-wrap items-center justify-between gap-3"><p>Owner access is unlocked on this device.</p><button disabled={unlocking} onClick={()=>void signOut()} className="min-h-11 rounded bg-white/10 px-4">Sign out of admin</button></div>:<form onSubmit={e=>{e.preventDefault();void unlock();}} className="space-y-3">
        <input required type="password" autoComplete="off" aria-label="Owner analytics key" value={adminKey} onChange={e=>setAdminKey(e.target.value)} placeholder="Private owner key" className="bg-white/10 rounded-lg p-3 w-full"/>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>Remember this private device for 30 days</label>
        <p className="text-xs text-gray-400">Use this only on your own phone or computer. Your owner key is never saved in browser storage.</p>
        <button disabled={unlocking||!adminKey} className="bg-purple-600 rounded-lg px-4 min-h-11 disabled:opacity-50">{unlocking?'Unlocking…':'Unlock admin'}</button>
      </form>}
      {ownerSession&&<>
        <AnonymousStats adminKey="" ownerSession />
        <DownloadStats adminKey="" ownerSession />
        <FeedbackInbox adminKey="" ownerSession />
        <TracklistDraftPanel adminKey="" ownerSession />
      </>}
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading admin analytics…
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100 flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {!loading && !error && data ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.map(({ key, label, icon: Icon }) => (
              <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/10 p-2">
                    <Icon className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{String(data[key])}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400">Use successful mix starts above for listening counts. Legacy stream requests exclude direct and cached playback; download requests are not confirmed completed files.</p>
          <PaperclipInsightCard
            title="Owner operations brief"
            className="shadow-xl shadow-cyan-950/10"
            compact
            summary={data.paperclip_summary ?? null}
          />
        </>
      ) : null}
    </section>
  );
}
