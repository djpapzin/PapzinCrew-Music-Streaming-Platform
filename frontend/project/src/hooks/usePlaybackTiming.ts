import { useRef, useState } from 'react';

export type StartKind = 'First play' | 'Track start' | 'Resume';
export interface PlaybackAttempt { id: number; title: string; kind: StartKind; startedAt: number; milliseconds?: number; status: 'waiting' | 'started' | 'cancelled' | 'failed'; }
export function usePlaybackTiming() {
  const [attempts, setAttempts] = useState<PlaybackAttempt[]>([]);
  const pending = useRef<PlaybackAttempt | null>(null);
  const sequence = useRef(0);
  const finish = (status: PlaybackAttempt['status'], id = pending.current?.id) => {
    const attempt = pending.current;
    if (!attempt || attempt.id !== id) return;
    pending.current = null;
    const result = { ...attempt, status, ...(status === 'started' ? { milliseconds: Math.max(0, performance.now() - attempt.startedAt) } : {}) };
    setAttempts(items => items.map(item => item.id === id ? result : item));
  };
  const begin = (title: string, kind: StartKind) => {
    finish('cancelled');
    const attempt: PlaybackAttempt = { id: ++sequence.current, title, kind, startedAt: performance.now(), status: 'waiting' };
    pending.current = attempt;
    setAttempts(items => [attempt, ...items].slice(0, 20));
    return attempt.id;
  };
  return { attempts, begin, finish, pending };
}
