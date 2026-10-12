import { useRef, useState } from 'react';

export const TIMING_KEY = 'papzincrew:playback-log:v1';
export const MAX_ATTEMPTS = 500;
export type StartKind = 'First play' | 'Track start' | 'Resume';
export interface PlaybackAttempt {
  id: number; title: string; kind: StartKind; startedAt: number; milliseconds?: number;
  status: 'waiting' | 'started' | 'cancelled' | 'failed';
  timestamp: string; browser: string; connection: string; version: string;
  bufferCount: number; bufferMs: number;
}
function readLog(): PlaybackAttempt[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(TIMING_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is PlaybackAttempt => item && Number.isFinite(item.id) && typeof item.title === 'string'
      && ['First play','Track start','Resume'].includes(item.kind) && ['waiting','started','cancelled','failed'].includes(item.status)
      && ['timestamp','browser','connection','version'].every(key => typeof item[key] === 'string')
      && Number.isFinite(item.bufferCount) && Number.isFinite(item.bufferMs)
      && (item.status !== 'started' || (Number.isFinite(item.milliseconds) && item.milliseconds >= 0)))
      .slice(0, MAX_ATTEMPTS).map(item => ({...item, startedAt: 0, status: item.status === 'waiting' ? 'cancelled' : item.status}));
  } catch { return []; }
}
export function playbackCsv(attempts: PlaybackAttempt[]) {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows = attempts.map(a => [a.timestamp,a.title,a.kind,a.status,a.milliseconds,a.bufferCount,a.bufferMs,a.browser,a.connection,a.version]);
  return '\uFEFF' + [['timestamp_utc','mix','attempt_type','status','startup_ms','buffer_count','buffer_ms','browser_device','connection','app_version'],...rows].map(row => row.map(cell).join(',')).join('\r\n');
}
export function usePlaybackTiming() {
  const [attempts, setAttempts] = useState<PlaybackAttempt[]>(readLog);
  const [storageError, setStorageError] = useState(false);
  const items = useRef(attempts);
  const pending = useRef<PlaybackAttempt | null>(null);
  const active = useRef<number | null>(null);
  const buffer = useRef<{id:number; since:number} | null>(null);
  const sequence = useRef(Math.max(0,...attempts.map(a => a.id)));
  const save = (next: PlaybackAttempt[]) => {
    items.current = next;
    setAttempts(next);
    try { localStorage.setItem(TIMING_KEY, JSON.stringify(next)); setStorageError(false); }
    catch { setStorageError(true); }
  };
  const endBuffer = () => {
    const current = buffer.current;
    if (!current) return;
    buffer.current = null;
    save(items.current.map(a => a.id === current.id ? {...a, bufferMs:a.bufferMs + Math.max(0, performance.now()-current.since)} : a));
  };
  const startBuffer = () => {
    if (pending.current || buffer.current || active.current === null) return;
    buffer.current = {id:active.current, since:performance.now()};
    save(items.current.map(a => a.id === active.current ? {...a, bufferCount:a.bufferCount+1} : a));
  };
  const finish = (status: PlaybackAttempt['status'], id = pending.current?.id) => {
    const attempt = pending.current;
    if (!attempt || attempt.id !== id) return;
    pending.current = null;
    active.current = status === 'started' ? attempt.id : null;
    const result = { ...attempt, status, ...(status === 'started' ? { milliseconds: Math.max(0, performance.now() - attempt.startedAt) } : {}) };
    save(items.current.map(item => item.id === id ? result : item));
  };
  const begin = (title: string, kind: StartKind) => {
    endBuffer();
    finish('cancelled');
    active.current = null;
    const connection = (navigator as Navigator & {connection?: {type?:string;effectiveType?:string}}).connection;
    const attempt: PlaybackAttempt = {
      id: ++sequence.current, title, kind, startedAt: performance.now(), status: 'waiting',
      timestamp:new Date().toISOString(), browser:navigator.userAgent,
      connection:connection?.type || (connection?.effectiveType ? `estimated ${connection.effectiveType}` : 'Unknown'),
      version:import.meta.env.VITE_APP_VERSION || 'development', bufferCount:0, bufferMs:0,
    };
    pending.current = attempt;
    save([attempt, ...items.current].slice(0, MAX_ATTEMPTS));
    return attempt.id;
  };
  return { attempts, storageError, begin, finish, pending, startBuffer, endBuffer };
}
