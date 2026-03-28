import { useCallback, useEffect, useMemo, useState } from 'react';
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
  { key: 'total_plays', label: 'Total plays', icon: PlayCircle },
  { key: 'total_downloads', label: 'Downloads', icon: Download },
  { key: 'total_storage_mb', label: 'Storage (MB)', icon: HardDrive },
] as const;

export default function AdminAnalyticsPanel() {
  const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const adminKey = useMemo(() => (import.meta as any).env?.VITE_ADMIN_API_KEY as string | undefined, []);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/admin/analytics`, {
        headers: adminKey ? { 'X-Admin-Api-Key': adminKey } : {},
      });

      if (!response.ok) {
        throw new Error(response.status === 403
          ? 'Admin API key missing or invalid. Set VITE_ADMIN_API_KEY to load admin analytics.'
          : `HTTP ${response.status}`);
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

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-slate-950 to-slate-900 p-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-cyan-300">
            <BarChart3 className="h-4 w-4" />
            Admin analytics
          </div>
          <h2 className="text-lg font-semibold text-white">Publish + ops snapshot</h2>
          <p className="mt-1 text-sm text-slate-300">A lightweight admin surface for the existing publish workflow, enriched with the same Paperclip summary coming through the backend consumer hook.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadAnalytics()}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

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

          <PaperclipInsightCard
            title="Paperclip admin brief"
            className="shadow-xl shadow-cyan-950/10"
            compact
            summary={data.paperclip_summary ?? null}
          />
        </>
      ) : null}
    </section>
  );
}
