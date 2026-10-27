import { afterEach, expect, it, vi } from 'vitest';
import { fetchCatalog } from './fetchCatalog';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
const ok=(data:unknown=[])=>({ok:true,status:200,json:async()=>data});
it('recovers a failed site proxy from the current VPS without calling Render',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce({ok:false,status:502}).mockResolvedValueOnce(ok([{id:237}]));vi.stubGlobal('fetch',fetch);
  expect(await fetchCatalog('/api',new AbortController().signal)).toEqual([{id:237}]);
  expect(fetch.mock.calls.map(c=>c[0])).toEqual(['/api/tracks/catalog','https://papzincrew-api.djpapzin.com/tracks/catalog']);
});
it('recovers network and malformed-response failures',async()=>{
  const fetch=vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(ok([]));vi.stubGlobal('fetch',fetch);
  await fetchCatalog('/api',new AbortController().signal);expect(fetch).toHaveBeenCalledTimes(2);
  fetch.mockReset().mockResolvedValueOnce(ok({error:'proxy response'})).mockResolvedValueOnce(ok([]));
  await fetchCatalog('/api',new AbortController().signal);expect(fetch).toHaveBeenCalledTimes(2);
});
it('bounds a hung request and uses the VPS after timeout',async()=>{
  vi.useFakeTimers();
  const fetch=vi.fn().mockImplementationOnce((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError'))))).mockResolvedValueOnce(ok([]));
  vi.stubGlobal('fetch',fetch);const pending=fetchCatalog('/api',new AbortController().signal);
  await vi.advanceTimersByTimeAsync(8000);expect(await pending).toEqual([]);expect(fetch).toHaveBeenCalledTimes(2);
});
it('does not bypass auth/rate-limit responses or send local development failures to production',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:false,status:403});vi.stubGlobal('fetch',fetch);
  await expect(fetchCatalog('/api',new AbortController().signal)).rejects.toThrow('403');expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockClear().mockResolvedValue({ok:false,status:503});
  await expect(fetchCatalog('http://localhost:8000',new AbortController().signal)).rejects.toThrow('503');expect(fetch).toHaveBeenCalledTimes(1);
});
it('cancels without starting a fallback when superseded or unmounted',async()=>{
  const controller=new AbortController();
  const fetch=vi.fn().mockImplementation((_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('cancel','AbortError')))));
  vi.stubGlobal('fetch',fetch);const pending=fetchCatalog('/api',controller.signal);controller.abort();
  await expect(pending).rejects.toThrow('cancel');expect(fetch).toHaveBeenCalledTimes(1);
});
