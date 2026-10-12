import { useEffect, useState } from 'react';
import { PlaybackAttempt } from '../hooks/usePlaybackTiming';
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
export default function PlaybackTiming({ attempts }: { attempts: PlaybackAttempt[] }) {
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
      <p>From your play request to the browser’s first playing event. Device or Bluetooth output delay is not included. Measurements stay on this page and reset when you reload.</p>
      {starts.length > 0 && <p>Track starts: average {seconds(starts.reduce((sum,item) => sum + item.milliseconds!,0) / starts.length)} · slowest {seconds(Math.max(...starts.map(item => item.milliseconds!)))} · {starts.length} measured. Resumes excluded.</p>}
      <p className="text-purple-300">Last 20 attempts, newest first. Buffering after startup does not change these times.</p>
      <ol className="space-y-2 max-h-48 overflow-y-auto">{attempts.map(item => <li key={item.id} className="break-words">{item.title} · {item.kind} · {item.status === 'started' ? seconds(item.milliseconds!) : item.status}</li>)}</ol>
    </div>
  </details>;
}
