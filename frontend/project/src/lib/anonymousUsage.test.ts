import { afterEach, expect, it, vi } from 'vitest';
import { createPlaybackUsage, recordVisit, sendUsage, USAGE_OPT_OUT } from './anonymousUsage';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();localStorage.clear();sessionStorage.clear();});
function setup(){vi.stubGlobal('location',{hostname:'crew.djpapzin.com',pathname:'/track/237'});vi.stubGlobal('matchMedia',()=>({matches:true}));const fetch=vi.fn(async()=>({ok:true}));vi.stubGlobal('fetch',fetch);return fetch;}
it('sends one visit per tab session, without identifiers or URL',()=>{const fetch=setup();recordVisit();recordVisit();expect(fetch).toHaveBeenCalledTimes(1);const body=JSON.parse(fetch.mock.calls[0][1].body);expect(body).toEqual({kind:'visit',mix:0,value:0,resume:false,device:'mobile'});});
it('respects opt out and DNT',()=>{const fetch=setup();localStorage.setItem(USAGE_OPT_OUT,'1');sendUsage('visit');expect(fetch).not.toHaveBeenCalled();localStorage.clear();vi.stubGlobal('navigator',{doNotTrack:'1'});sendUsage('visit');expect(fetch).not.toHaveBeenCalled();});
it('counts only playing wall time, excludes pauses, and reports failure once',()=>{const fetch=setup();let now=100;vi.spyOn(performance,'now').mockImplementation(()=>now);const usage=createPlaybackUsage();usage.begin('237',false);now=2100;usage.started();now=7100;usage.stop();now=20000;usage.started();now=24000;usage.failed();usage.failed();const events=fetch.mock.calls.map(call=>JSON.parse(call[1].body));expect(events.filter(e=>e.kind==='start')).toHaveLength(1);expect(events.find(e=>e.kind==='start').value).toBe(2000);expect(events.filter(e=>e.kind==='listen').reduce((sum,e)=>sum+e.value,0)).toBe(9000);expect(events.filter(e=>e.kind==='failed')).toHaveLength(1);});
it('preserves a full minute and the paused tail without doubling listening time',()=>{
 const fetch=setup();let now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);
 const usage=createPlaybackUsage();usage.begin('237',false);usage.started();
 now=60000;usage.flush();now=75000;usage.stop();now=120000;usage.stop();
 const listens=fetch.mock.calls.map(call=>JSON.parse(call[1].body)).filter(e=>e.kind==='listen');
 expect(listens.map(e=>e.value)).toEqual([60000,15000]);
});
