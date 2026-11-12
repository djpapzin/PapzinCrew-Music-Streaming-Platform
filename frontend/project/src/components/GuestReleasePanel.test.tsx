import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import GuestReleasePanel from './GuestReleasePanel';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const detail={id:1,title:'Guest release',artist:'Guest DJ',cover_art_url:'',duration_seconds:150,tracklist:'',review_url:'https://crew.djpapzin.com/track/1',fingerprint:'a'.repeat(64),revision:0,stale:false,test_only:false,checks:{audio_ready:false,title_credit_approved:false,presentation_approved:false,playback_verified:false,musical_approved:false},notes:'',caption:'Let’s Cruize! Guest release',release_time:'',final_approved:false,approved_at:null};
const queue={mixes:[{id:1,title:'Guest release',artist:'Guest DJ',test_only:false}]};
const response=(data:unknown,ok=true)=>({ok,json:async()=>data});
async function load() {
 fireEvent.change(await screen.findByLabelText('Unlisted mix'),{target:{value:'1'}});
 fireEvent.click(screen.getByRole('button',{name:'Load review'}));await screen.findByText('Guest release — Guest DJ');
}
it('records owner checks without publishing and revalidates before copying',async()=>{
 let saved=detail;
 const copy=vi.fn().mockResolvedValue(undefined);vi.stubGlobal('navigator',{clipboard:{writeText:copy}});
 const fetch=vi.fn(async(url:string,options?:RequestInit)=>{
  if(url.endsWith('/releases'))return response(queue);
  if(options?.method==='PUT'){
   const data=JSON.parse(options.body as string);
   saved={...detail,...data,checks:Object.fromEntries(Object.keys(detail.checks).map(key=>[key,data[key]])),revision:1};return response(saved);
  }
  return response(saved);
 });vi.stubGlobal('fetch',fetch);render(<GuestReleasePanel/>);await screen.findByRole('option',{name:/#1/});await load();
 expect(screen.getByRole('button',{name:'Record final approval'})).toBeDisabled();expect(screen.getByRole('button',{name:'Copy approved draft'})).toBeDisabled();
 for(const checkbox of screen.getAllByRole('checkbox'))fireEvent.click(checkbox);
 fireEvent.click(screen.getByRole('button',{name:'Record final approval'}));await screen.findByText('Final approval recorded. The mix remains unlisted.');
 fireEvent.click(screen.getByRole('button',{name:'Copy approved draft'}));await waitFor(()=>expect(copy).toHaveBeenCalledWith(detail.caption));
 expect(fetch.mock.calls.filter(([,o])=>o?.method==='PUT')).toHaveLength(1);expect(fetch.mock.calls.every(([url])=>url.includes('/admin/releases'))).toBe(true);
});
it('keeps notes on failed save and blocks test approval',async()=>{
 const fetch=vi.fn(async(url:string,options?:RequestInit)=>url.endsWith('/releases')?response(queue):options?.method==='PUT'?response({detail:'This mix changed. Reload the review.'},false):response({...detail,test_only:true,checks:Object.fromEntries(Object.keys(detail.checks).map(key=>[key,true]))}));
 vi.stubGlobal('fetch',fetch);render(<GuestReleasePanel/>);await screen.findByRole('option',{name:/#1/});await load();
 expect(screen.getByRole('button',{name:'Record final approval'})).toBeDisabled();fireEvent.change(screen.getByLabelText('Private review notes'),{target:{value:'Keep my notes'}});
 fireEvent.click(screen.getByRole('button',{name:'Save private review'}));await screen.findByText('This mix changed. Reload the review.');expect(screen.getByLabelText('Private review notes')).toHaveValue('Keep my notes');
});
it('refuses copying an approval invalidated on the server',async()=>{
 let gets=0;const copy=vi.fn();vi.stubGlobal('navigator',{clipboard:{writeText:copy}});
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.endsWith('/releases')?response(queue):response({...detail,final_approved:++gets===1,checks:Object.fromEntries(Object.keys(detail.checks).map(key=>[key,true]))})));
 render(<GuestReleasePanel/>);await screen.findByRole('option',{name:/#1/});await load();fireEvent.click(screen.getByRole('button',{name:'Copy approved draft'}));
 await screen.findByText('This review changed. Reload and approve the current version before copying.');expect(copy).not.toHaveBeenCalled();
});
it('retries loading the queue after an error',async()=>{
 let calls=0;vi.stubGlobal('fetch',vi.fn(async()=>++calls===1?response({},false):response(queue)));
 render(<GuestReleasePanel/>);await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Refresh release queue'}));await screen.findByRole('option',{name:/#1/});
});
