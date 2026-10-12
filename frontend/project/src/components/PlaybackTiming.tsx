import { useEffect, useState } from 'react';
import { PlaybackAttempt, playbackCsv } from '../hooks/usePlaybackTiming';
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
export default function PlaybackTiming({ attempts, storageError }: { attempts: PlaybackAttempt[]; storageError: boolean }) {
  const latest = attempts[0];
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (latest?.status !== 'waiting') return;
    const tick = () => setElapsed(performance.now() - latest.startedAt);
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [latest?.id, latest?.status]);
  if (!latest) return null;
  const completed = attempts.filter(item => item.status === 'started');
  const starts = completed.filter(item => item.kind !== 'Resume');
  const summary = latest.status === 'waiting' ? `Starting… ${seconds(elapsed)}` : latest.status === 'started' ? `${latest.kind === 'Resume' ? 'Resumed' : 'Started'} in ${seconds(latest.milliseconds!)}` : latest.status === 'failed' ? 'Playback start failed' : 'Playback start cancelled';
  return <details className="mx-4 mt-3 rounded-xl border border-purple-400/20 bg-purple-950/30 text-sm text-purple-100 shrink-0">
    <summary className="cursor-pointer min-h-11 px-4 py-3">{summary} <span className="text-purple-300">· Playback timing</span></summary>
    <div className="px-4 pb-4 space-y-3">
      <p>From your play request to the browser’s first playing event. Device or Bluetooth output delay is not included. The latest 500 attempts are saved in this browser on this device. Export regularly: clearing browser data removes the log. Other browsers and your Home Screen app may have separate storage.</p>
      {starts.length > 0 && <p>Track starts: average {seconds(starts.reduce((sum,item) => sum + item.milliseconds!,0) / starts.length)} · slowest {seconds(Math.max(...starts.map(item => item.milliseconds!)))} · {starts.length} measured. Resumes excluded.</p>}
      <p className="text-purple-300">Showing the latest 20 attempts. Export includes all saved attempts. Buffering is measured separately; seeking is excluded. Connection type may be unavailable on iPhone.</p>
      {storageError && <p role="alert">This browser could not save the log. Export now to keep these results.</p>}
      <button className="min-h-11 px-4 rounded-lg bg-purple-600 hover:bg-purple-500" onClick={() => {
        const url = URL.createObjectURL(new Blob([playbackCsv(attempts)], {type:'text/csv;charset=utf-8;'}));
        const link = document.createElement('a'); link.href = url; link.download = `papzincrew-playback-${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      }}>Export CSV ({attempts.length})</button>
      <ol className="space-y-2 max-h-48 overflow-y-auto">{attempts.slice(0,20).map(item => <li key={item.id} className="break-words">{new Date(item.timestamp).toLocaleString()} · {item.title} · {item.kind} · {item.status === 'started' ? seconds(item.milliseconds!) : item.status} · {item.bufferCount} buffering interruptions ({seconds(item.bufferMs)})</li>)}</ol>
    </div>
  </details>;
}
