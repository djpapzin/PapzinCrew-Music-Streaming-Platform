import { act, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { usePlaybackTiming, playbackCsv, TIMING_KEY } from './usePlaybackTiming';
beforeEach(()=>localStorage.clear());
afterEach(()=>vi.restoreAllMocks());
it('restores completed results after reload and cancels abandoned starts',()=>{
 const first=renderHook(()=>usePlaybackTiming());
 act(()=>{first.result.current.begin('Mix 1','First play');first.result.current.finish('started');first.result.current.begin('Mix 2','Track start');});
 first.unmount();
 const restored=renderHook(()=>usePlaybackTiming());
 expect(restored.result.current.attempts.map(a=>a.status)).toEqual(['cancelled','started']);
 expect(restored.result.current.attempts[1].timestamp).toMatch(/^\d{4}-/);
 act(()=>restored.result.current.begin('Mix 3','First play'));
 expect(new Set(restored.result.current.attempts.map(a=>a.id)).size).toBe(3);
});
it('counts buffering once per interruption without altering startup time',()=>{
 let now=100;vi.spyOn(performance,'now').mockImplementation(()=>now);
 const hook=renderHook(()=>usePlaybackTiming());
 act(()=>{hook.result.current.begin('Mix','First play');hook.result.current.startBuffer();});
 now=200;act(()=>hook.result.current.finish('started'));
 now=500;act(()=>{hook.result.current.startBuffer();hook.result.current.startBuffer();});
 now=900;act(()=>hook.result.current.endBuffer());
 expect(hook.result.current.attempts[0]).toMatchObject({milliseconds:100,bufferCount:1,bufferMs:400});
 expect(JSON.parse(localStorage.getItem(TIMING_KEY)!)[0].bufferMs).toBe(400);
});
it('handles malformed storage and reports failed writes without breaking playback',()=>{
 localStorage.setItem(TIMING_KEY,'{"bad":true}');
 const hook=renderHook(()=>usePlaybackTiming());expect(hook.result.current.attempts).toEqual([]);
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
 act(()=>hook.result.current.begin('Mix','First play'));
 expect(hook.result.current.storageError).toBe(true);expect(hook.result.current.attempts).toHaveLength(1);
});
it('exports quoted data safely and caps retention at 500',()=>{
 localStorage.setItem(TIMING_KEY, JSON.stringify(Array.from({length:500},(_,i)=>({id:i+1,title:'Mix',kind:'Track start',status:'cancelled',timestamp:new Date().toISOString(),browser:'test',connection:'Unknown',version:'test',bufferCount:0,bufferMs:0,startedAt:0}))));
 const hook=renderHook(()=>usePlaybackTiming());
 act(()=>hook.result.current.begin('=SUM(1,2) "mix"','Track start'));
 expect(hook.result.current.attempts).toHaveLength(500);
 const csv=playbackCsv(hook.result.current.attempts);
 expect(csv).toContain('startup_ms');expect(csv).toContain('"\'=SUM(1,2) ""mix"""');
 expect(csv.split('\r\n')).toHaveLength(501);
});
