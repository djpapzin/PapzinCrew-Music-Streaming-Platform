import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { toAbsoluteApiUrl } from '../lib/api';

export interface PaperclipSummary {
  goal_id: string;
  initiative_id: string;
  initiative_title: string;
  business_status_summary: string;
  current_tracker_phase: string;
  blocker_summary: string;
  next_milestone: string;
  risk_flag: string;
  budget_flag: string;
  storage_flag: string;
  linked_tracker_cards: string[];
  last_updated: string;
  audit_ref: string;
}

interface PaperclipInsightCardProps {
  taskId?: number | string | null;
  title?: string;
  className?: string;
  compact?: boolean;
  summary?: PaperclipSummary | null;
}

const resolveTaskId = (taskId?: number | string | null) => {
  if (taskId !== undefined && taskId !== null && `${taskId}`.trim()) {
    return Number(taskId);
  }

  const envTaskId = (import.meta as any).env?.VITE_PAPERCLIP_TASK_ID;
  if (envTaskId !== undefined && envTaskId !== null && `${envTaskId}`.trim()) {
    return Number(envTaskId);
  }

  return Number.NaN;
};

const chipClass = 'rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-purple-100';

export default function PaperclipInsightCard({
  taskId,
  title = 'Paperclip insight',
  className = '',
  compact = false,
  summary: preloadedSummary = null,
}: PaperclipInsightCardProps) {
  const resolvedTaskId = useMemo(() => resolveTaskId(taskId), [taskId]);
  const [summary, setSummary] = useState<PaperclipSummary | null>(preloadedSummary);
  const [loading, setLoading] = useState(!preloadedSummary);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (preloadedSummary) {
      setSummary(preloadedSummary);
      setError(null);
      setLoading(false);
      return;
    }

    if (!Number.isFinite(resolvedTaskId)) {
      setSummary(null);
      setError('Set a Paperclip task context first, or configure VITE_PAPERCLIP_TASK_ID for an explicit environment fallback.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(toAbsoluteApiUrl(`/paperclip/summary/${resolvedTaskId}`));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as PaperclipSummary;
      setSummary(payload);
    } catch (err) {
      setSummary(null);
      setError(err instanceof Error ? err.message : 'Unable to load Paperclip summary.');
    } finally {
      setLoading(false);
    }
  }, [preloadedSummary, resolvedTaskId]);

  useEffect(() => {
    if (preloadedSummary) {
      setSummary(preloadedSummary);
      setError(null);
      setLoading(false);
      return;
    }

    void loadSummary();
  }, [loadSummary, preloadedSummary]);

  return (
    <section className={`rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-slate-950 to-slate-900 p-4 shadow-lg shadow-fuchsia-950/20 ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-fuchsia-300">
            <Sparkles className="h-4 w-4" />
            {title}
          </div>
          <h2 className="text-lg font-semibold text-white">Task #{Number.isFinite(resolvedTaskId) ? resolvedTaskId : '—'}</h2>
          <p className="mt-1 text-sm text-slate-300">Live Paperclip guidance from the company brain, pulled through the backend consumer hook.</p>
        </div>

        {!preloadedSummary ? (
          <button
            type="button"
            onClick={() => void loadSummary()}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
            aria-label="Refresh Paperclip insight"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        {loading && <p className="text-sm text-slate-300">Loading Paperclip insight…</p>}

        {!loading && error && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-100">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && summary && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className={chipClass}>Phase: {summary.current_tracker_phase}</span>
              <span className={chipClass}>Risk: {summary.risk_flag}</span>
              <span className={chipClass}>Budget: {summary.budget_flag}</span>
              <span className={chipClass}>Storage: {summary.storage_flag}</span>
            </div>

            <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Business summary</p>
                <p className="mt-1 text-sm text-white">{summary.business_status_summary}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Next milestone</p>
                <p className="mt-1 text-sm text-slate-200">{summary.next_milestone}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Blocker</p>
                <p className="mt-1 text-sm text-slate-200">{summary.blocker_summary}</p>
              </div>
              {!compact ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Initiative</p>
                  <p className="mt-1 text-sm text-slate-200">{summary.initiative_title}</p>
                </div>
              ) : null}
            </div>

            {!compact ? (
              <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full bg-white/5 px-2.5 py-1">Goal: {summary.goal_id}</span>
                <span className="rounded-full bg-white/5 px-2.5 py-1">Initiative: {summary.initiative_id}</span>
                <span className="rounded-full bg-white/5 px-2.5 py-1">Updated: {summary.last_updated}</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full bg-white/5 px-2.5 py-1">Initiative: {summary.initiative_title}</span>
                <span className="rounded-full bg-white/5 px-2.5 py-1">Updated: {summary.last_updated}</span>
              </div>
            )}

            {summary.linked_tracker_cards?.length ? (
              <p className="text-xs text-slate-400">Linked cards: {summary.linked_tracker_cards.join(', ')}</p>
            ) : null}
          </div>
        )}

        {!loading && !error && !summary && (
          <p className="text-sm text-slate-300">No Paperclip summary returned yet.</p>
        )}
      </div>
    </section>
  );
}
